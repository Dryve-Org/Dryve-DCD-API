import express, { Request, Response } from 'express'
import { createStripeCustomer, createCard, reteiveCards, removeCard, reteiveCard } from '../../constants/moneyHandling'
import { CardI } from '../../interfaces/moneyHandling'
import Address, { AddressI } from '../../Models/address.model'
import User, { UserI } from '../../Models/user.model'
import { isOfAge, isUnixDate, now } from '../../constants/time'
import bcrypt from "bcrypt"
import { auth, authBodyI, UserDocT } from '../../middleware/auth'
import validator from 'validator'
import _, { pick } from 'lodash'
import Order, { OrderstatusT } from '../../Models/Order.model'
import { err, extractUnitId } from '../../constants/general'
import Apt from '../../Models/aparmtent/apartment.model'
import UnitVerifySession from '../../Models/sessions/unitVerify.model'

const userRouter = express.Router()

interface postUserI extends UserI {
    card?: CardI
    sameAddressforCard: boolean
}

/*  
    Create user/client
    
    A client is a default user that will
    request to get their clothes dry cleaned
*/

/* Creating a new user. */
userRouter.post('/', async (req: Request<{}, {}, postUserI>, res: Response) => {
    try {
        //get user data from body withou address, cards, and card
        const { address, cards, card, ...userData } = req.body
        const addressData = address

        const user = new User(userData)
        if(!user) {
            throw "server error: retreiving user"
        }
        
        const customer = await createStripeCustomer(user.email)

        user.created = now()

        user.stripeId = customer.id

        //edit: validate address
        const addy = new Address(addressData)
        await user.save()
        
        addy
            .save()
            .then(result => {
                user.address = result._id
                //saving new address as first pickupAddress
                user.pickUpAddresses = [ result.id ]
                user.save()
            })
        
        //if card was provided
        if(req.body.card) {
            const card = await createCard(
                user, 
                req.body.card, 
                req.body.sameAddressforCard ? addy : undefined
            )
            
            //add new card id to user cards
            user.cards = [ card.id ]
        }

        await user.save()

        const token = await user.generateAuthToken()

        res.send(token)
    } catch(e) {
        res.send(e)
    }
})

interface LoginBodyI {
    username: string,
    password: string
}

/*
    User Login

    //edit: make this more asynchronous
*/
userRouter.post('/login', async (req: Request<{}, {}, LoginBodyI>, res: Response) => {
    try {
        const genericError = "Invalid email or password"
        const { username, password } = req.body

        //finding user with this email
        const user = await User.findOne({ email: username })
        if(!user) {
            res.status(401).send(genericError)
            return
        }
        
        //is password valid
        const validPassword = await bcrypt.compare(password, user.password)
        if(!validPassword) {
            res.status(401).send(genericError)
            return
        }

        //generating token
        const token = await user.generateAuthToken()
        
        res.send(token)
    } catch(e) {
        res.status(400).send(e)
    }
})

userRouter.get(
'/verify_unit/:sessionId',
async (req: Request<{ sessionId: string }, {}, {}>, res: Response) => {
    try {
        const { sessionId } = req.params

        const sessionData = await UnitVerifySession.findById(sessionId)
        
        if(!sessionData) {
            throw 'invalid session Id'
        }

        await sessionData.verify()

        res.status(200).send(`
            ${ sessionData.userEmail } is verified to unit.
            Complex Name: ${ sessionData.aptName }
            building: ${ sessionData.bldNum },
            Unit: ${ sessionData.unitNum },
            UnitId: ${ sessionData.unitId },
        `)

        UnitVerifySession.findByIdAndDelete(sessionId)
    } catch(e) {
        res.status(400).send(e)
    }
})


/* A route that is used to retrieve a user's information. */
userRouter.get('/', auth, async (req: Request<{}, {}, authBodyI>, res: Response) => {
    try {
        const { user } = req.body
        const errors: any = {}

        const client = await User.findById(user._id,
            {
                password: 0,
            }    
        )
        .populate('address')

        if(!client) {
            errors.server = "server error: client retrieval"
            throw errors
        }

        res.status(200).send(client)
    } catch(e) {
        res.send(e)
    }
})

interface getFieldParams {
    field: "pickups" |
           "cards" |
           "address" |
           "pickUpAddresses" |
           "preferredCleaner" |
           "pickupAddress"
}

/*
    User retreiving specific client information
*/
userRouter.get('/retreive/:field', auth, async (req: Request<getFieldParams, {}, authBodyI>, res: Response) => {
    try {
        let { field } = req.params
        const { user } = req.body
        
        //so that field matches for the next line
        field = field === "pickups" ? "pickUpAddresses" : field

        const validFields = [
            "pickups",
            "cards",
            "address",
            "pickUpAddresses",
            "preferredCleaner",
            "pickupAddress"
        ]

        if(!validFields.includes(field)) throw 'invalid field requested'

        //find and populate necessary data
        const clientData = await User
            .findById(req.body._id)
            .select({
                [field]: 1
            })
            .populate(field)
            .exec()
        
        if(clientData === null) throw {
            statusCode: 500,
            message: "server error: failed to retreive client pickup addresses"
        }

        /* Mapping the pickUpAddresses array and adding a default property to each object in the array. */
        if(field === "pickUpAddresses") {
            const pickUps: any[] = clientData.pickUpAddresses ? clientData.pickUpAddresses : []

            console.log('clientData.pickUpAddresses', clientData)

            //delault: is this address this default
            const withDefault = pickUps.map(pickUp => ({
                //@ts-ignore
                ...pickUp['_doc'],
                default: pickUp._id.toString() === user.pickupAddress?.toString()
            }))

            //ignore type value. This return all address information
            res.status(200).send(withDefault)
            return
        }

        /* Checking if the field is pickupAddress. If it is, it is returning the pickupAddress object. */
        if(field === 'pickupAddress') {
            const pickUp = clientData.pickupAddress ? clientData.pickupAddress : {}

            console.log('pickup: ', pickUp)

            res.status(200).send(pickUp)
            return
        }

        
        /* Checking if the field is cards. If it is, it is checking if the clientData.cards.length is
        0. If it is, it is throwing an error. If it is not, it is retrieving the cards from stripe
        and sending them back to the client. */
        if(field === "cards") {
            if(clientData.cards.length = 0) throw {
                statusCode: 400,
                message: "user has no save cards"
            }
            //getting cards from stripe
            const cards = await reteiveCards(clientData.cards)

            res.status(200).send(cards)
            return
        } 

        if(field === "address") {
            res.status(200).send(clientData.address)
            return
        }

        /* Populating the clientData with the preferredCleaner field. */
        if(field === 'preferredCleaner') {
            await clientData
                .populate({
                    path: field,
                    model: 'Cleaner',
                    select: {
                        activeOrders: 0,
                        orders: 0
                    },
                    populate: [
                        {
                            path: 'address',
                            model: 'Address'
                        },
                        {
                            path: 'services',
                            model: 'Service'
                        }
                    ]
                })

            res.status(200).send(clientData[field])
            return
        }
        
        throw 'invalid parameter'
    } catch(e: any) {
        res.status(400).send(e)
    }
})

interface UpdateUserI extends UserI {
    user: UserDocT
}

/*
    Update User by each valid property
*/
/* It's updating a user's information. */
userRouter.put('/', auth, async (req: Request<{}, {}, UpdateUserI>, res: Response) => {
    try {
        const neededUpdates = Object.keys(req.body)
        const user = req.body.user

        const validUpdates = [
            "firstName",
            "lastName",
            "address",
            "dob",
            "phoneNumber",
            "email"
        ]
        let err: any

        //don't be afraid of this monstrosity.
        /*
            This is updating each given property
            and ensure that it's getting formatted
            and stored properly
        */
        neededUpdates.forEach(async (update) => {
            //this is ingoring non-updatable values
            if(["_id", "token", 'user'].includes(update)) return
            try {
                //if given an invalid property throw
                if(!validUpdates.includes(update)) throw "invalid update property"

                //if email
                /* 
                    edit: must validate if user can manage
                    this email
                */
                if(update === "email") {
                    /// validating email ///
                    if(!validator.isEmail(req.body.email)) throw "invalid email"
                    if(user.email === req.body.email) throw "Email cannot be the same as before"
                    const userWithEmail = await User.findOne({ email: req.body.email })

                    if(userWithEmail) throw "User with this email exist"
                }

                //if address
                if(update === "address") {
                    const address = await Address.findById(req.body._id)
                    const addressUpdates = Object.keys(req.body.address)

                    //valid properties user could provide
                    const validAddressUpdates = [
                        "street_address_line_1",
                        "street_address_line_2",
                        "city",
                        "state",
                        "zipcode",
                        "country",
                        "apt"
                    ]

                    addressUpdates.forEach(addyProp => {
                        //throw if property is not valid
                        if(!validAddressUpdates.includes(addyProp)) throw "invalid address property"

                        // @ts-ignore
                        address[addyProp] = req.body.address[addyProp]
                    })
                    return
                }

                //if date of birth (dob)
                if(update === "dob") {
                    if(!isUnixDate(req.body.dob)) throw "date of birth must be in unix format"
                    if(!isOfAge(req.body.dob)) throw "must be older than 18"
                }

                //typescript doesn't like this method
                //edit: try fixing this if you like
                // @ts-ignore
                user[update] = req.body[update]
            } catch (e) {
                err = e
            }
        })

        //if loop return any err
        if(err) throw err

        await user.save()

        res.send(user)
    } catch(e) {
        res.send(e)
    }
})

interface preferredCardI extends authBodyI {
    cardId: string
}

/* Updating the user's preferred card. */
// userRouter.put(
// '/preferred_card',
// auth,
// async (req: Request<{}, {}, preferredCardI>, res: Response) => {
//     try {
//         const { 
//             user,
//             cardId
//         } = req.body

//         const card = await reteiveCard(cardId)
//         if(!card) {
//             throw 'invalid card'
//         }

//         user.preferredCardId = cardId

//         user.save()
//             .then(() => {
//                 res.status(200).send('card updated')
//             })
//             .catch(() => {
//                 res.status(500).send(
//                     'unable to update card'
//                 )
//             })
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })

interface updateCardResI extends authBodyI {
    cardId: string
}

/*
    Remove card from stripe and user.
    passed through body for privacy
*/
// userRouter.delete('/card', auth, async (req: Request<{}, {}, updateCardResI>, res: Response) => {
//     try {
//         const { user, _id, cardId } = req.body
//         //remove card from stripe
//         await removeCard(_id, cardId)

//         //remove card id from user cards
//         _.remove(user.cards, (id) => {
//             return id === cardId
//         })

//         //store update user
//         await user.save()

//         res.status(200).send("card removed successfully")
//     } catch(e: any) {
//         res.status(400).send(e)
//     }
// })

/*
    Client Track Driver
*/
userRouter.get(
'/track_driver/:orderId',
auth,
async (req: Request<{ orderId: string }, {}, authBodyI>, res: Response) => {
    try {
        const { orderId } = req.params
        const { user } = req.body
        const validStatuses: OrderstatusT[] = [
            'Picked Up From Cleaner',
            'Pickup Driver On the Way',
            'Clothes to Home'
        ]

        /// retrieve and validate order ///
        const order = await Order.findById(orderId)
        if(!order) throw 'invalid order id'

        //is this the client to this order
        if(order.client.toString() !== user._id.toString()) throw (
            'user not attached to this order'
        )

        //can user track this order
        if(!validStatuses.includes(order.status)) {
            res.status(401).send('user cannot track order at this time')
            return
        }

        if(!order.driverLocation) {
            res.status(200).send([])
            return
        }

        res.status(200).send(order.driverLocation.coordinates)
    } catch(e) {
        res.status(400).send(e)
    }
})

userRouter.post(
'/queue/:unitId',
auth,
async (req: Request<{ unitId: string }, {}, authBodyI>, res: Response) => {
    try {
        const { unitId } = req.params
        const { user } = req.body

        if(!user.attachedUnitIds.includes(unitId)) throw err(400, 'invalid unit Id')

        const [ aptId ] = extractUnitId(unitId)

        const apt = await Apt.findOne({ aptId }, {buildings: 1})
        if(!apt) throw err(400, 'invalid unit Id')

        await apt.queueUnit(unitId)
        const unitData = apt.getUnitId(unitId)
        if(!unitData) throw err(500, 'data should have been retreived')
        const [ ,, unit ] = unitData

        res.status(200).send(unit)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        } else {
            res.status(500).send(e)
        }
    }
})

userRouter.post(
'/unqueue/:unitId',
auth,
async (req: Request<{ unitId: string }, {}, authBodyI>, res: Response) => {
    try {
        const { unitId } = req.params
        const { user } = req.body

        if(!user.attachedUnitIds.includes(unitId)) throw err(400, 'invalid unit Id')

        const [ aptId ] = extractUnitId(unitId)

        const apt = await Apt.findOne({ aptId }, {buildings: 1})
        if(!apt) throw err(400, 'invalid unit Id')

        await apt.dequeueUnit(unitId)
        const unitData = apt.getUnitId(unitId)
        if(!unitData) throw err(500, 'data should have been retreived')
        const [ ,, unit ] = unitData

        res.status(200).send(unit)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        } else {
            res.status(500).send(e)
        }
    }
})


export default userRouter