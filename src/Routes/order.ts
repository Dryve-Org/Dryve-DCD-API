
// /*
//     Routes will be copied over to 
//     corresponding authorization levels
// */

// import { config } from 'dotenv'
// config()
// import { Router, Request, Response } from 'express'
// import { auth, authBodyI, cleanerProManagerAuth, cleanerProManagerAuthI, driverAuth, DriverAuthI } from '../middleware/auth'
// import Order, { OrderI, orderStatuses, OrderstatusT } from '../Models/Order.model'
// import User, { UserI } from '../Models/user.model'
// import { createClientCharge, reteiveCard } from '../constants/moneyHandling'
// import Address, { AddressI } from '../Models/address.model'
// import Cleaner from '../Models/cleaner.model'
// import Driver from '../Models/driver.model'
// import { getDistance, getDistanceById } from '../constants/location'
// import { Types } from 'mongoose'
// import { handleDesiredServices, idToString } from '../constants/general'
// import { addressExist, cleanerExist } from '../constants/validation'
// import { now } from '../constants/time'


// const orderRouter = Router()

// interface AddressPopI {
//     origin: AddressI
//     cleanerAddress: AddressI
// }

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

// orderRouter.post('/client/requestPickup', auth, async (req: Request<{}, {}, PostOrderBody>, res: Response) => {
//     try {
//         //// initializing needed from body ////
//         const {
//             cardId,
//             cleanerId,
//             desiredServices,
//             user,
//             pickupAddress,
//             dropOffAddress
//         } = req.body
//         //// quick validation ////
//         if(typeof desiredServices !== 'object') throw 'bad data: desiredServices'
//         if(!idToString(user.pickUpAddresses).includes(pickupAddress)) {
//             throw 'pick up address does not exist'
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
//         .catch(e => {
//             res.status(402).send('could not find card')
//         })
        
//         //retreive order fee
//         const orderFeeCost: number = 500 //edit: this will come from the database

//         //calculate service requested
//         const { total } = await handleDesiredServices(desiredServices)

//         const toCleaner = await getDistanceById(pickupAddress, cleaner.address)
//         const fromCleaner = await getDistanceById(
//             cleaner.address, 
//             dropOffAddress ? dropOffAddress : pickupAddress
//         )
        
//         //initializing and setting order data
//         const order = new Order({
//             client: user._id,
//             origin: pickupAddress,
//             cleaner: cleanerId,
//             cleanerAddress: cleaner.address,
//             toCleanerDistance: toCleaner.distance,
//             fromCleanerDistance: fromCleaner.distance,
//             dropOffAddress,
//             isDropOff: false,
//             orderTotal: total,
//             userCard: cardId,
//             orderFeePaid: false,
//             created: now(),
//             status: "Task Posted Pickup",
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

//         res.send(order)
//     } catch (e: any) {
//         res.status(400).send(e)
//     }
// })

// interface DriverOrderConfirmI extends DriverAuthI {
//     orderId: string
// }

// orderRouter.post('/driver/confirm', driverAuth, async (req: Request<{}, {}, DriverOrderConfirmI>, res: Response) => {
//     try {
//         const {
//             isAuthorized,
//             driver,
//             isDriver,
//             orderId
//         } = req.body
//         if(isAuthorized) res.status(402).send("not authorize to drive")

//         const validStatuses = [
//             "Task Posted Pickup", 
//             "Task Posted Dropoff"
//         ]

//         const order = await Order.findById(orderId)
//             .populate<AddressPopI>(['origin', 'cleanerAddress'])
//             .exec()
//         console.log("order: ", order)
//         if(!order || !validStatuses.includes(order.status)) {
//             res.status(400).send("invalid order")
//             return
//         }

//         const isPickup = order.status === "Task Posted Pickup"
//         const fromTo = {
//             from: isPickup ? order.origin : order.cleanerAddress,
//             to: isPickup ? order.cleanerAddress : order.origin //edit: dropoffAddress should replace this origin
//         }
//         const distance = await getDistance(fromTo.from, fromTo.to)

//         let price = order.orderFeePaid ? order.orderFee : 0

//         price = distance.distance * 88

//         const client = await User.findById(order.client)
//         if(!client) {
//             res.status(500).send("client not found")
//             return
//         }

//         const payment = await createClientCharge(
//             client, 
//             order.userCard,
//             price, 
//             {
//                 chargingFor: "from Cleaner",
//                 feeIncluded: !order.orderFeePaid
//             },
//             !order.orderFeePaid
//         )

//         if(payment?.status !== "succeeded") {
//             res.status(402).send("could not complete payment")
//             return
//         }

//         order.status = isPickup ? "Pickup Driver On the Way" : "Dropoff Driver On the Way"

//         order[isPickup ? "pickUpDriver" : "dropOffDriver"] = driver._id
//         order[isPickup ? "pickUpCostId" : "dropOffCostId"] = payment.id

//         order.save()

//         res.status(200).send({
//             orderStatus: order.status,
//             orderCost: price
//         })
//     } catch(e: any) {
//         res.send(e)
//     }
// })

// interface putStoreArrivalI extends cleanerProManagerAuthI {
//     driverId: string
//     cleanerId: string
// }

// orderRouter.put('/store_arrival', cleanerProManagerAuth, async (req: Request<{}, {}, putStoreArrivalI>, res: Response) => {
//     try {
//         const {
//             cleanerPro,
//             driverId,
//             cleanerId,
//             isAdmin,
//             isManager
//         } = req.body
        
//         //if cleaner profile is not attached to store
//         if(!cleanerPro.attachedCleaners.includes(cleanerId as unknown as Types.ObjectId) && cleanerPro) {
//             res.status(402).send("Cleaner profile not authorized for this store")
//         }

//         const driver = await Driver.findById(driverId)
//         if(!driver) throw {
//             statusCode: 400,
//             message: "bad data: could not retreive driver"
//         }

//         const cleaner = await Cleaner.findById(cleanerId)
//         if(!cleaner) throw {
//             status: 400,
//             message: "bad data: could not retreive cleaner"
//         }

//         const order = await Order.find({
//             pickUpDriver: driverId,
//             cleaner: cleanerId,
//             status: "Clothes to Cleaner"
//         })

//         res.send(order)
//     } catch (e: any) {
//         res.send("something went wrong")
//     }
// })

// interface AddressClientI extends AddressPopI {
//     client: UserI
// }

// orderRouter.get('/driver/:orderId', driverAuth, async (req: Request<{ orderId: string }, {}, {}>, res: Response) => {
//     try {
//         const { orderId } = req.params     

//         const order = await Order.findById(orderId, '-_id')
//             .populate<AddressClientI>(['origin', 'cleanerAddress', 'client'])
//             .exec()
//         if(!order) {
//             res.status(400).send("was not able to retreive order")
//             return
//         }

//         const distanceMatrix = await getDistance(order.origin, order.cleanerAddress)
//             .catch(e => console.log(e))    

//         res.send(order) //edit: make sure driver only sees necessary information
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })




// export default orderRouter