// /*
//     this file is no longer needed really
//     will delete when client folder is fully tested
// */

// import bcrypt from "bcrypt"
// import express, { Request, Response } from "express"
// import validator from "validator"
// import { isOfAge, isUnixDate } from "../constants/time"
// import { auth, authBodyI, UserDocT } from "../middleware/auth"
// import Address, { AddressI } from "../Models/address.model"
// import User, { UserI } from '../Models/user.model'
// import { createCard, createStripeCustomer, removeCard, reteiveCard, reteiveCards } from '../constants/moneyHandling'
// import { CardI } from "../interfaces/moneyHandling"
// import Stripe from 'stripe'
// import { now } from '../constants/time'
// import { geoHandleAddress, getDistanceById, getMeters, validateGeo } from "../constants/location"
// import _ from "lodash"
// import Order from "../Models/Order.model"
// import { handleDesiredServices, idToString, stringToId } from "../constants/general"
// import { addressExist } from "../constants/validation"
// import Cleaner from "../Models/cleaner.model"
// import { activeOrdersIds } from "../constants/clientHandler"

// const clientRouter = express.Router()

// interface postUserI extends UserI {
//     card?: CardI
//     sameAddressforCard: boolean
// }

// /*  
//     Create user/client
    
//     A client is a default user that will
//     request to get their clothes dry cleaned
// */ 
// clientRouter.post('/', async (req: Request<{}, {}, postUserI>, res: Response) => {
//     try {
//         //get user data from body withou address, cards, and card
//         const { address, cards, card, ...userData } = req.body
//         const addressData = address

//         const user = new User(userData)
//         if(!user) {
//             throw "server error: retreiving user"
//         }
        
//         const customer = await createStripeCustomer(user.email)

//         user.created = now()

//         user.stripeId = customer.id

//         //edit: validate address
//         const addy = new Address(addressData)
//         await user.save()
        
//         addy
//             .save()
//             .then(result => {
//                 user.address = result._id
//                 //saving new address as first pickupAddress
//                 user.pickUpAddresses = [ result.id ]
//                 user.save()
//             })
        
//         //if card was provided
//         if(req.body.card) {
//             const card = await createCard(
//                 user, 
//                 req.body.card, 
//                 req.body.sameAddressforCard ? addy : undefined
//             )
            
//             //add new card id to user cards
//             user.cards = [ card.id ]
//         }

//         await user.save()

//         const token = await user.generateAuthToken()

//         res.send(token)
//     } catch(e) {
//         res.send(e)
//     }
// })

// interface postCardI extends authBodyI {
//     card: CardI
//     address: AddressI
// }

// /*
//     User add card to their account

//     //edit: need to validate card
// */
// clientRouter.post('/card', auth, async (req: Request<{}, {}, postCardI>, res: Response) => {
//     try {
//         const { _id, card, address, user } = req.body

//         //creating card with string
//         const addedCard = await createCard(user, card, address)

//         //adding card to the user's cards
//         user.cards = [ ...user.cards, addedCard.id ]

//         user.save()
//             .then(() => {
//                 res.status(200).send('card added')
//             })
//             .catch(() => {
//                 res.status(500).send('unable to create card')
//             })

//         res.send({ cardId: addedCard.id })
//     } catch (e) {
//         res.status(400).send(e)
//     }
// })

// interface LoginBodyI {
//     username: string,
//     password: string
// }

// /*
//     User Login

//     //edit: make this more asynchronous
// */
// clientRouter.post('/login', async (req: Request<{}, {}, LoginBodyI>, res: Response) => {
//     try {
//         const genericError = "Invalid email or password"
//         const { username, password } = req.body

//         //finding user with this email
//         const user = await User.findOne({ email: username })
//         if(!user) {
//             res.status(401).send(genericError)
//             return
//         }
        
//         //is password valid
//         const validPassword = await bcrypt.compare(password, user.password)
//         if(!validPassword) {
//             res.status(401).send(genericError)
//             return
//         }

//         //generating token
//         const token = await user.generateAuthToken()
        
//         res.send(token)
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })

// /*
//     User retreiving client information
// */
// clientRouter.get('/', auth, async (req: Request<{}, {}, authBody>, res: Response) => {
//     try {
//         const errors: any = {}
//         const client = await User.findById(req.body._id, '', { lean: true })
//             .populate<{ address: AddressI }>('address')
//             .exec()

//         if(!client) {
//             errors.server = "server error: client retrieval"
//             throw errors
//         }

//         const originAddress = await geoHandleAddress(client.address)

//         const { 
//             token, 
//             password,
//             stripeId,
//             __v,
//             ...filteredClient 
//         } = client  

//         let cardsData: Stripe.PaymentMethod[]

//         cardsData = client.cards && client.cards.length ? await reteiveCards(client.cards) : []

//         res.status(200).send({
//             ...filteredClient,
//             cardsData,
//         })
//     } catch(e) {
//         res.send(e)
//     }
// })

// interface getFieldParams {
//     field: "pickups" |
//            "cards" |
//            "address" |
//            "pickUpAddresses" |
//            "preferredCleaner"
// }

// interface authBody {
//     token: string,
//     _id: string
// }

// /*
//     User retreiving specific client information
// */
// clientRouter.get('/retreive/:field', auth, async (req: Request<getFieldParams, {}, authBody>, res: Response) => {
//     try {
//         let { field } = req.params
        
//         //so that field matches for the next line
//         field = field === "pickups" ? "pickUpAddresses" : field

//         const validFields = [
//             "pickups",
//             "cards",
//             "address",
//             "pickUpAddresses",
//             "preferredCleaner"
//         ]

//         if(!validFields.includes(field)) throw 'invalid field requested'

//         //find and populate necessary data

//         const clientData = await User
//             .findById(req.body._id)
//             .select({[field]: 1})
//             .populate(field)
//             .exec()
        
//         if(clientData === null) throw {
//             statusCode: 500,
//             message: "server error: failed to retreive client pickup addresses"
//         }

//         if(field === "pickUpAddresses") {
//             const pickUps = clientData.pickUpAddresses ? clientData.pickUpAddresses : []

//             //ignore type value. This return all address information
//             res.status(200).send(pickUps)
//             return
//         }

//         if(field === "cards") {
//             if(clientData.cards.length = 0) throw {
//                 statusCode: 400,
//                 message: "user has no save cards"
//             }
//             //getting cards from stripe
//             const cards = await reteiveCards(clientData.cards)

//             res.status(200).send(cards)
//             return
//         } 

//         if(field === "address") {
//             res.status(200).send(clientData.address)
//             return
//         }

//         if(field === 'preferredCleaner') {
//             await clientData.populate(`${ field }.services`)

//             res.status(200).send(clientData[field])
//             return
//         }
        
//     } catch(e: any) {
//         res.status(e.statusCode).send(e)
//     }
// })

// interface UpdateUserI extends UserI {
//     user: UserDocT
// }

// /*
//     Update User by each valid property
// */
// clientRouter.put('/', auth, async (req: Request<{}, {}, UpdateUserI>, res: Response) => {
//     try {
//         const neededUpdates = Object.keys(req.body)
//         const user = req.body.user

//         const validUpdates = [
//             "firstName",
//             "lastName",
//             "address",
//             "dob",
//             "phoneNumber",
//             "email"
//         ]
//         let err: any

//         //don't be afraid of this monstrosity.
//         /*
//             This is updating each given property
//             and ensure that it's getting formatted
//             and stored properly
//         */
//         neededUpdates.forEach(async (update) => {
//             //this is ingoring non-updatable values
//             if(["_id", "token", 'user'].includes(update)) return
//             try {
//                 //if given an invalid property throw
//                 if(!validUpdates.includes(update)) throw "invalid update property"

//                 //if email
//                 /* 
//                     edit: must validate if user can manage
//                     this email
//                 */
//                 if(update === "email") {
//                     /// validating email ///
//                     if(!validator.isEmail(req.body.email)) throw "invalid email"
//                     if(user.email === req.body.email) throw "Email cannot be the same as before"
//                     const userWithEmail = await User.findOne({ email: req.body.email })

//                     if(userWithEmail) throw "User with this email exist"
//                 }

//                 //if address
//                 if(update === "address") {
//                     const address = await Address.findById(req.body._id)
//                     const addressUpdates = Object.keys(req.body.address)

//                     //valid properties user could provide
//                     const validAddressUpdates = [
//                         "street_address_line_1",
//                         "street_address_line_2",
//                         "city",
//                         "state",
//                         "zipcode",
//                         "country",
//                         "apt"
//                     ]

//                     addressUpdates.forEach(addyProp => {
//                         //throw if property is not valid
//                         if(!validAddressUpdates.includes(addyProp)) throw "invalid address property"

//                         // @ts-ignore
//                         address[addyProp] = req.body.address[addyProp]
//                     })
//                     return
//                 }

//                 //if date of birth (dob)
//                 if(update === "dob") {
//                     if(!isUnixDate(req.body.dob)) throw "date of birth must be in unix format"
//                     if(!isOfAge(req.body.dob)) throw "must be older than 18"
//                 }

//                 //typescript doesn't like this method
//                 //edit: try fixing this if you like
//                 // @ts-ignore
//                 user[update] = req.body[update]
//             } catch (e) {
//                 err = e
//             }
//         })

//         //if loop return any err
//         if(err) throw err

//         await user.save()

//         res.send(user)
//     } catch(e) {
//         res.send(e)
//     }
// })

// interface updateCardResI extends authBodyI {
//     cardId: string
// }

// /*
//     Remove card from stripe and user.
// */
// clientRouter.delete('/card', auth, async (req: Request<{}, {}, updateCardResI>, res: Response) => {
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

// interface PostOrderBody extends authBodyI {
//     originId: string,
//     pickupAddress: string
//     cardId: string // user card id
//     toCleanerDistance: number //in miles ex. 1.23
//     fromCleanerDistance: number
//     cleanerId: string
//     clientId: string
//     pickUpDriver?: string
//     dropOffDriver?: string
//     desiredServices: {
//         quantity: number,
//         service: string //stored prices of each service
//     }[]
//     created: number
//     dropOffAddress?: string
// }

// /*
//     Client Create order
// */
// clientRouter.post('/request_pickup', auth, async (req: Request<{}, {}, PostOrderBody>, res: Response) => {
//     try {
//         //// initializing needed from body ////
//         const {
//             cardId,
//             cleanerId,
//             desiredServices,
//             originId,
//             user,
//             pickupAddress,
//             dropOffAddress
//         } = req.body
//         //// quick validation ////
//         if(!desiredServices.length) throw 'bad data: desiredServices'

//         if(!idToString(user.pickUpAddresses).includes(pickupAddress)) {
//             throw 'pick up address does not exist'
//         }

//         //does user have active orders
//         if((await activeOrdersIds(user.orders)).length) {
//             res.status(403).send('cannot have more than one active order')
//             return
//         }

//         //validate provided addresses
//         const origin = await addressExist(pickupAddress)
//         if(!origin) throw 'pickup address is not attached to user'

//         if(dropOffAddress) {
//             if(!idToString(user.pickUpAddresses).includes(dropOffAddress)) {
//                 throw 'dropoff address does not exist'
//             }
//             const validDropOff = await addressExist(dropOffAddress)
//             if(!validDropOff) throw 'invalid dropOff Id'
//         }

//         //validate cleaner
//         //edit: is this cleaner less than 25 miles away
//         const cleaner = await Cleaner.findById(cleanerId)
//         if(!cleaner) throw 'cleaner does not exist'

//         //validate card
//         const card = await reteiveCard(cardId)
//             .catch(e => {
//                 throw {
//                     statusCode: e.statusCode,
//                     message: "bad data: invalid card"
//                 }
//             })
        
//         //retreive order fee
//         const orderFeeCost: number = 500 //edit: this will come from the database

//         //calculate service requested
//         const { total } = await handleDesiredServices(desiredServices)

//         const toCleaner = getDistanceById(pickupAddress, cleaner.address)
//         const fromCleaner = getDistanceById(
//             cleaner.address, 
//             dropOffAddress ? dropOffAddress : pickupAddress
//         )
        
//         //initializing and setting order data
//         const order = new Order({
//             client: user._id,
//             origin: pickupAddress,
//             cleaner: cleanerId,
//             cleanerAddress: cleaner.address,
//             toCleanerDistance: (await toCleaner).distance,
//             fromCleanerDistance: (await fromCleaner).distance,
//             dropOffAddress,
//             isDropOff: false,
//             orderTotal: total,
//             userCard: cardId,
//             orderFeePaid: false,
//             created: now(),
//             status: 'Task Posted Pickup',
//             desiredServices,
//             createdBy: {
//                 userType: 'client',
//                 userTypeId: user._id
//             }
//         })

//         // add order id to user
//         if(user.orders){
//             user.orders.push(order._id)
//         } else {
//             user.orders = [ order._id ]
//         }
        
//         //add order to cleaner profile
//         cleaner.activeOrders.push(order._id)
//         cleaner.orders.push(order._id)    

//         await order.save()
//             .catch((e) => {
//                 console.log(e)
//                 res.status(400).send('unable to save order')
//                 throw ''
//             })
        
//         user.save()
//             .catch(e => {
//                 console.log(e)
//             })

//         //async update cleaner
//         cleaner.save()
//             .catch(e => {
//                 console.log(e)
//             })

//         res.send(order)
//     } catch (e: any) {
//         res.status(400).send(e)
//     }
// })

// /*
//     Client Track Driver
// */
// clientRouter.get(
// '/track_driver/:orderId',
// auth,
// async (req: Request<{ orderId: string }, {}, authBodyI>, res: Response) => {
//     try {
//         const { orderId } = req.params
//         const { user } = req.body
//         const validStatuses = [
//             'Pickup Driver On the Way',
//             'Pickup Driver approaching',
//             'Clothes to Home'
//         ]

//         /// retrieve and validate order ///
//         const order = await Order.findById(orderId)
//         if(!order) throw 'invalid order id'

//         //is this the client to this order
//         if(order.client.toString() !== user._id.toString()) throw (
//             'user not attached to this order'
//         )

//         //can user track this order
//         if(!validStatuses.includes(order.status)) {
//             res.status(401).send('user cannot track order at this time')
//             return
//         }

//         if(!order.driverLocation) {
//             res.status(200).send([])
//             return
//         }

//         res.status(200).send(order.driverLocation.coordinates)
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })

// /*
//     Cleaners Nearby
// */
// interface authLocationI extends authBodyI{
//     latitude: number
//     longitude: number
//     maxDistance: number //orders within this range in miles
// }

// clientRouter.post(
// '/cleaners_nearby',
// auth,
// async (req: Request<{}, {}, authLocationI>, res: Response) => {
//     try {
//         const { 
//             maxDistance,
//             latitude,
//             longitude,
//             user
//         } = req.body
//         if(!validateGeo([latitude, longitude])) throw 'bad data: invalid geo location'
//         if(!latitude || !longitude || !maxDistance) throw 'bad data: invalid body'

//         const cleaners = await Cleaner.find({
//             'address.location': {
//                 $near: {
//                     $maxDistance: getMeters(maxDistance),
//                     $geometry: {
//                         type: 'Point',
//                         coordinates: [ longitude, latitude ]
//                     }
//                 }
//             }
//         })
//         .lean()
//         .populate({
//             path: 'address',
//             model: 'Address'
//         })
//         .select({
//             activeOrders: 0,
//             orders: 0,
//             '__v': 0
//         })

//         //return nearby cleaner with preferred included
//         //preferred: is this the user's preferred cleaner
//         const withPreferred = cleaners.map(cln => (
//             {
//                 ...cln, 
//                 preferred: cln._id.toString() === user.preferredCleaner?.toString()
//             }
//         ))

//         res.status(200).send(withPreferred)
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })

// /*
//     get Cleaner information
// */
// clientRouter.get(
// '/cleaner/:cleanerId',
// auth,
// async (req: Request<{ cleanerId: string }, {}, authBodyI>, res: Response) => {
//     try {
//         const { cleanerId } = req.params
//         const { user } = req.body

//         //retreive cleaner by id
//         const cleaner = await Cleaner.findById(cleanerId)
//         .lean()
//         .select({
//             'paymentMethod': 0,
//             'stripeId': 0,
//             'activeOrders': 0,
//             'orders': 0
//         })
//         .populate([
//             {
//                 path: 'address',
//                 model: 'Address'
//             },
//             {
//                 path: 'services',
//                 model: 'Service'
//             }
//         ])
//         //cleaner failed
//         if(!cleaner) throw 'invalid cleaner id'

//         res.status(200).send({
//             ...cleaner,
//             preferred: cleanerId === user.preferredCleaner?.toString()
//         })
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })

// /*
//     get active orders
// */
// clientRouter.get(
// '/active_orders',
// auth,
// async (req: Request<{ cleanerId: string }, {}, authBodyI>, res: Response) => {
//     try {
//         const { user } = req.body

//         const activeOrders = await activeOrdersIds(user.orders)

//         res.status(200).send(activeOrders)
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })

// /*
//     set preferred cleaner
// */
// clientRouter.put(
// '/preferred_cleaner/:cleanerId',
// auth,
// async (req: Request<{ cleanerId: string }, {}, authBodyI>, res: Response) => {
//     try {
//         const { cleanerId } = req.params
//         const { user } = req.body

//         //checking if cleaner exists
//         const cleaner = await Cleaner.exists({ _id: cleanerId})
//         if(!cleaner?._id || !cleaner) throw 'invalid cleaner id'

//         //adding attaching to user
//         user.preferredCleaner = stringToId(cleanerId)[0]

//         await user.save().catch(() => {
//             res.status(500).send('unable to save preferred cleaner')
//         })

//         res.status(200).send('updated preferred cleaner')
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })


// export default clientRouter