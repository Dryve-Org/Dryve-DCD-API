import { Response, Request, Router } from 'express'
import { handleDesiredServices, idToString, intersectIds, stringToId } from '../constants/general'
import { isOfAge, now } from '../constants/time'
import { addressExist, cleanerExist, cleanerProExist, cleanersExist, isManagerclnProAuth, userExist } from '../constants/validation'
import { auth, managerAuth, ManagerAuthI } from '../middleware/auth'
import Cleaner from '../Models/cleaner.model'
import CleanerProfile, { CleanerProfileI } from '../Models/cleanerProfile.model'
import Manager, { ManagerI } from '../Models/manager.models'
import User from '../Models/user.model'
import _ from 'lodash'
import { AddressI } from '../Models/address.model'
import { addAddress, getDistanceById } from '../constants/location'
import Order, { OrderI, OrderstatusT } from '../Models/Order.model'
import { CardI } from '../interfaces/moneyHandling'
import validator from 'validator'
import { createCard, createStripeCustomer } from '../constants/moneyHandling'
import Service from '../Models/services.model'
import Apt from '../Models/apartment.model'

const managerRouter = Router()

interface PostManagerI extends ManagerAuthI {
    userId: string
    cleaners?: string[]
}

managerRouter.post('/', managerAuth, async (req: Request<{}, {}, PostManagerI>, res: Response) => {
    try {
        const { 
            userId,
            cleaners,
            isAdmin
        } = req.body


        //// authorization ////
        //only admin can create managers
        //this business requirement may change
        if(!isAdmin) {
            res.status(401).send('invalid access')
            return
        }

        //// validation ////
        //validate provided cleaners
        if(!cleaners) throw 'managers must manage at least one cleaner'
        const theCleaners = await Cleaner.find({
            '_id': { $in: cleaners }
        })
        if(!theCleaners) throw 'bad data: one or more store ids are invalid'

        const user = await User.findById(userId)
        if(!user) throw 'bad data: user does not exist'


        //// initializing and storing ////
        const manager = new Manager({
            userId,
            attachedStores: stringToId(cleaners)
        })

        manager.created = now()

        await manager.save()

        res.send(manager)
    } catch(e: any) {
        res.status(400).send(e)
    }
})

interface ManCreateOrderI extends ManagerAuthI {
    userEmail: string
    cleanerId: string
    desiredServices?: {
        quantity: number,
        service: string //stored prices of each service
    }[]
    isDropOff: boolean
    dropOffAddressId?: string
    pickUpAddressId?: string
    newDropOffAddress?: AddressI
    newPickUpAddress?: AddressI
    status: OrderstatusT
    cardId: string
}

/* 
    Manager create order

    order can started a pick or
    dropoff depending on the
    boolean of isDropOff

    If the place id matches address the user's
    stored address don't create a new address.
    If address then add it to user before
    attaching to order
*/
managerRouter.post('/order/create', managerAuth, async (req: Request<{}, {}, ManCreateOrderI>, res: Response) => {
    try {
        //// initializing needed from body ////
        const {
            userEmail,
            cleanerId,
            desiredServices,
            isDropOff,
            newDropOffAddress,
            newPickUpAddress,
            dropOffAddressId,
            pickUpAddressId,
            manager,
            status,
            cardId
        } = req.body
        
        //// quick validation ////
        //does manager contain this cleaner id
        if(!idToString(manager.attachedStores).includes(cleanerId)) { 
            throw 'bad data: not authorized to create order for this cleaner'
        }
        if(!isDropOff && !desiredServices?.length) throw 'bad data: a pick must have necessary information'
        if(isDropOff) {
            if(!newDropOffAddress && !dropOffAddressId) throw 'bad data: need a dropoff location'
        } else {
            if(!pickUpAddressId && !newPickUpAddress) throw 'bad data: needed pick up location'
        }

        const cleaner = await Cleaner.findById(cleanerId)
        const user = await User.findOne({ email: userEmail })
        
        if(!cleaner) throw 'bad data could not find cleaner'
        if(!user) throw 'bad data: unable to find user'

        /// order will have data added throughout ///
        const order = new Order()

        //getting user by provided email

        //desired services must be provide
        //before going to cleaners
        if(!isDropOff && desiredServices) {
            const {
                total
            } = await handleDesiredServices(desiredServices)

            order.serviceCost = total
            order.orderTotal = total
            order.desiredServices = desiredServices
        }

        //setting order data
        order.client = user._id
        order.cleaner = cleaner._id
        order.cleanerAddress = cleaner.address
        order.isDropOff = isDropOff
        order.orderFeePaid = false
        order.userCard = cardId
        order.createdBy = {
            userType: 'manager',
            userTypeId: manager._id
        }
        order.created = now()
        
        // updating cleaner
        //edit: this should be handle in pre save
        cleaner.activeOrders.push(order._id)
        cleaner.orders.push(order._id)

        // status that can be created in this route
        const validStatuses = [
            "Task Posted Pickup",
            "Task Posted Dropoff",
            "Clothes Awaiting Clean",
            "Clothes Ready"
        ]

        if(status) {
            if(!validStatuses.includes(status)) throw {
                validStatuses,
                message: 'invalid status'
            }
            order.status = status
        } else {
            order.status = isDropOff ? 'Task Posted Dropoff' : 'Task Posted Pickup'
        }

        //// validating and adding provided address ids ////
        if(pickUpAddressId) {
            if(!idToString(user.pickUpAddresses).includes(pickUpAddressId)) {
                throw 'pick up address id not found with this user'
            }
            const isAddress = await addressExist(pickUpAddressId)
            if(!isAddress) throw 'bad data: invalid pick up address'
            order.origin = stringToId(pickUpAddressId)[0] 
        }

        if(dropOffAddressId) {
            //if user does not have matching
            //address id in user.pickUpAddresses
            if(!idToString(user.pickUpAddresses).includes(dropOffAddressId)) {
                throw 'drop off address id not found with this user'
            }
            const isAddress = await addressExist(dropOffAddressId)
            if(!isAddress) throw 'bad data: invalid pick up address'
            order.dropOffAddress = stringToId(dropOffAddressId)[0] 
        }

        /// handle new address and add to user ///
        if(!order.origin && newPickUpAddress) {
            //add address then push new id to user.pickAddresses
            const addedAddy = await addAddress(newPickUpAddress, (addy) => {
                user.pickUpAddresses.push(addy._id)
            })

            if(!addedAddy) throw 'bad data: invalid pick up address'
            order.origin = addedAddy._id
        }
    
        if(isDropOff && newDropOffAddress) {
            //add address then push new id to user.pickAddresses
            order.dropOffAddress = await addAddress(newDropOffAddress, (addy) => {
                user.pickUpAddresses.push(addy._id)
            }).then(res => res._id)
        }

        /// calculating distance ///
        if(order.origin && order.cleanerAddress) {
            const toCleaner = getDistanceById(order.origin, order.cleanerAddress)
                .then(data => data.distance)
            
            const fromCleaner = getDistanceById(
                order.cleanerAddress, 
                order.dropOffAddress ? order.dropOffAddress : order.cleanerAddress
            ).then(data => data.distance)
                
            order.toCleanerDistance = await toCleaner
            order.fromCleanerDistance = await fromCleaner
        }

        //async: storing updated cleaner
        cleaner.save()

        order.save().catch((e) => {
            res.status(500).send('unable to create order' + e.path)
            throw ''
        })

        user.orders.push(order._id)

        user.save()

        res.status(200).send(order)
    } catch(e: any) {
        res.status(400).send(e)
    }
})

interface PostCleanerProI extends ManagerAuthI{
    attachedCleaners: string[]
    profileId: string
    ownerOf?: string[]
}

/*
    Manager create cleaner profile
*/
managerRouter.post('/cleanerPro/create', managerAuth, async (req: Request<{}, {}, PostCleanerProI>, res: Response) => {
    try {
        const {
            manager,
            attachedCleaners,
            profileId,
            ownerOf,
            user,
            _id
        } = req.body

        //// validating provided information ////
        //was cleaners provided
        if(!attachedCleaners.length) {
            res.status(400).send('bad data')
            return
        }

        //checking if manager is making himself a cleanerPro
        if(_id.toString() === profileId.trim()) {
            res.send(400).send(`You're already a manager`)
            return
        }

        //checking if provided cleaners are valid
        if(!await cleanersExist(attachedCleaners)){
            res.status(400).send('invalid cleanerIds were sent')
            return
        }

        //checking if provided user profile id is valid
        if(!await userExist(profileId)) {
            res.status(400).send('invalid userId')
            return
        }

        //checking if provided already a cleanePro
        if(await cleanerProExist(profileId)) {
            res.status(400).send('bad data')
            return
        }

        //// initialization and setting ////
        const cleanerProfile = new CleanerProfile({
            user: profileId,
            attachedCleaners,
            created: now()
        })

        await cleanerProfile.save()
            .catch(() => {
                res.status(500).send('internal error: could not create cleaner profile')
                return
            })

        res.send(cleanerProfile)
    } catch(e) {
        res.status(400).send(e)
    }
})



interface addCleanerToCleanerProI extends ManagerAuthI{
    cleaners: string | string[]
}

/*
    Manager add cleaner to a
    cleaner profile 
*/
managerRouter.put('/cleanerPro/addCleaner/:cleanerProId', managerAuth, async (req: Request<{ cleanerProId: string }, {}, addCleanerToCleanerProI>, res: Response) => {
    try {
        const { cleanerProId } = req.params
        const {
            manager,
            cleaners
        } = req.body

        //is provided cleaners an array or string
        const cleanersArr = typeof cleaners === 'object' ? cleaners : [ cleaners ]

        //can manager manage these ids
        if(_.difference(cleanersArr, idToString(manager.attachedStores)).length) throw `
            you can't manage some or all cleaners requested
        `

        //does cleanerPro work for manager's cleaners
        const { auth, cleanerPro, status, message } = await isManagerclnProAuth(manager, cleanerProId)
        //hint: if message is true it's an error
        if(message || !auth) {
            res.status(status).send(message ? message : "you're not authorized")
            return
        }

        //validation provided cleaner ids
        if(!await cleanersExist(idToString(cleaners))) {
            res.status(400).send('bad data')
            return
        }

        //uniquely add new cleaner ids
        cleanerPro.attachedCleaners = _.union(cleanerPro.attachedCleaners, stringToId(cleanersArr))
        //storing new information
        CleanerProfile.findOneAndUpdate({
            _id: cleanerPro._id
        }, { attachedStores: cleanerPro.attachedCleaners })
            .then(cleanerPro => {
                res.status(200).send(cleanerPro)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    manager remove a cleaner from
    a provided cleaner profile
*/
managerRouter.put('/cleanerPro/removeCleaner/:cleanerProId', managerAuth, async (req: Request<{ cleanerProId: string }, {}, addCleanerToCleanerProI>, res: Response) => {
    try {
        const { cleanerProId } = req.params
        const {
            manager,
            cleaners
        } = req.body
        
        //is provided cleaners an array or string
        const cleanersArr = typeof cleaners === 'object' ? cleaners : [ cleaners ]

        //can manager manage these ids
        if(_.difference(cleanersArr, idToString(manager.attachedStores)).length) throw `
            bad data
        `
        //does cleanerPro work for manager's cleaners
        const { auth, cleanerPro, status, message } = await isManagerclnProAuth(manager, cleanerProId)
        if(message || !auth) {
            res.status(status).send(message ? message : "you're not authorized")
            return
        }

        //validation provided cleaner ids
        if(!await cleanersExist(idToString(cleaners))) throw "bad data"

        //remove any matching cleaner from cleanerpro
        cleanerPro.attachedCleaners = _.pullAll(cleanerPro.attachedCleaners, stringToId(cleanersArr))
        await CleanerProfile.findOneAndUpdate({
            _id: cleanerPro._id
        }, { attachedStores: cleanerPro.attachedCleaners })

        res.send(cleanerPro)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*  
    manager remove a cleaner profile   

    more logic should be added here like:
    cannot delete if only CleanerPro for a store.
    Probably would be best to just deactivate instead of 
    deleting.
*/
managerRouter.delete('/cleanerPro/:cleanerProId', managerAuth, async (req: Request<{ cleanerProId: string }, {}, ManagerAuthI>, res: Response) => {
    try {
        const { cleanerProId } = req.params
        const { manager } = req.body

        //does manager stores match up
        const { auth } = await isManagerclnProAuth(manager, cleanerProId)
        if(!auth) {
            res.status(401).send("you're not authorized")
            return
        }

        //removing cleaner from collection
        CleanerProfile.findByIdAndDelete(cleanerProId)
            .then(cleanerPro => {
                res.status(200).send(cleanerPro)
                return
            })
            .catch(() => {
                res.status(500).send('unable to store information')
            })

        
    } catch(e) {
        res.status(400).send(e)
    }
})

interface ManCreateUserI extends ManagerAuthI {
    email: string
    firstName: string
    lastName: string
    dob: number
    phoneNumber: string
    password: string
    card?: CardI
    sameAddressforCard: boolean
    pickUpAddress?: AddressI // default to user.address if not there
    address: AddressI
}

/*
    manager create new user
*/
managerRouter.post(
'/client/create', 
managerAuth, 
async (req: Request<{}, {}, ManCreateUserI>, res: Response) => {
    try {
        const {
            card,
            sameAddressforCard,
            dob,
            phoneNumber,
            password,
            email,
            address,
            firstName,
            lastName
        } = req.body

        //// validation ////
        if(!firstName && !lastName) throw 'first and last name must be provided'
        if(!validator.isEmail(email)) throw 'invalid emial'
        if(!isOfAge(dob)) throw 'user must be above 18 years of age'
        if(password.length < 3) throw 'password must be 3 characters or greater'
        if(!validator.isMobilePhone(phoneNumber)) throw 'this is not a phone number'
        if(await userExist(email)) throw 'user with this email already exists'

        //initialize user object
        const user = new User()
        //creating new address in address collection
        //then adding to user's pick up address and home address
        const addy = await addAddress(address, (addy) => {
            user.address = addy._id
            user.pickUpAddresses = [ addy._id ]
            return addy
        })

        //// setting user data ////
        user.email = email
        user.password = password
        user.dob = dob
        user.phoneNumber = phoneNumber
        const customer = await createStripeCustomer(email)
        user.stripeId = customer.id
        user.created = now()
        user.firstName = firstName
        user.lastName = lastName

        //if card was provided
        if(card) {
            //create card with stripe
            //then retreive stripe card id
            const newCard = await createCard(
                user,
                card,
                sameAddressforCard ? addy : undefined
            )
                
            //then store user.cards
            user.cards = [ newCard.id ]
        }

        user.save()
            .then(() => {
                res.status(200).send(user)
                return
            })
            .catch(() => {
                res.status(500).send('unable to store new user')
                return
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface ManCreateServiceI extends ManagerAuthI {
    cleanerId: string
    title: string
    price: number
    description: string
}

/*
    Creating a cleaner service
*/
managerRouter.post(
'/service/create',
managerAuth,
async (req: Request<{}, {}, ManCreateServiceI>, res: Response) => {
    try {
        const {
            manager,
            title,
            price,
            description,
            cleanerId
        } = req.body
        //// quick validation ////
        if(!idToString(manager.attachedStores).includes(cleanerId)) {
            res.status(401).send('not authorized to manage this cleaner')
            return
        }
        if(!title) throw 'bad data'
        //price must be above a dallor
        if(typeof price !== 'number' || price < 100) throw 'bad data'

        //
        const cleaner = await Cleaner.findById(cleanerId)
        if(!cleaner) throw 'could not find cleaner'

        //initializing services
        const service = new Service({
            title,
            price,
            description: description ? description : ""
        })
        service.save().catch(() => {
            res.status(500).send('unable to add new service')
            return
        })

        //adding new service to cleaner
        cleaner.services.push(service._id)

        cleaner.save()
            .then(newCleaner => {
                res.status(200).send(newCleaner)
                return
            })
            .catch(() => {
                res.status(500).send('service was save but unable to attach to cleaner')
                return
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface CreateAptI extends ManagerAuthI {
    address: AddressI
    name: string
    email: string
}

/* Creating a new apartment. */
managerRouter.post(
'/apt',
managerAuth,
async (req: Request<{}, {}, CreateAptI>, res: Response) => {
    try {
        const {
            manager,
            name,
            email,
            address
        } = req.body

        if(!name || !email || !address) throw `
            invalid body
        `

        const addy = await addAddress(address)

        const apt = await Apt.create({
            name,
            email,
            address: addy._id,
            createdBy: {
                userType: 'manager',
                userTypeId: manager._id
            }
        })

        await apt.save()
            .then(() => {
                res.status(200).send(apt)
            })
            .catch(() => {
                res.status(500).send(
                    'unable to create apt'
                )
            })

        
    } catch(e) {
        res.status(400).send(e)
    }
})

export default managerRouter