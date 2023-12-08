import express, {
    Request,
    Response,
    Router
} from 'express'
import { managerAuth, ManagerAuthI } from '../../middleware/auth'
import User, { UserI } from '../../Models/user.model'
import { AddressI } from '../../Models/address.model'
import { CardI } from '../../interfaces/moneyHandling'
import validator from 'validator'
import { isOfAge, now } from '../../constants/time'
import { userExist } from '../../constants/validation'
import { addAddress } from '../../constants/location'
import { createCard, createStripeCustomer, stripe } from '../../constants/moneyHandling'
import { clientPopulate, clientSelect } from './constants/clientOutputs'
import { err, extractUnitId, idToString } from '../../constants/general'
import Apt from '../../Models/aparmtent/apartment.model'
import e from 'express'

const ClientR = Router()

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

ClientR.get(
'/client/checkSubscription/:value', 
managerAuth, 
async (req: Request<{value: string}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { value } = req.params
        
        let user

        if(!validator.isEmail(value)) {
            user = await User.findById(value, clientSelect)
                .populate(clientPopulate)
            
        } else {
            user = await User.findOne({ email: value }, clientSelect)
                .populate(clientPopulate)
        }

        if(!user) throw 'user not found'

        const subData = await user.checkClientSubcription()
        
        res.status(200).send(subData)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    manager create new user
*/
ClientR.post(
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
        if(await userExist(email)) throw 'user with this email already exists'
        if(!isOfAge(dob)) throw 'user must be above 18 years of age'
        if(password.length < 3) throw 'password must be 3 characters or greater'
        if(!validator.isMobilePhone(phoneNumber)) throw 'this is not a phone number'

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
        const customer = await createStripeCustomer(
            email,
            firstName,
            lastName
        )
        user.stripeId = customer.id
        user.created = now()
        user.firstName = firstName
        user.lastName = lastName

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

/**
 * Get client by id/email
 */
ClientR.get(
'/client/:value',
managerAuth,
async (req: Request<{value: string}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { value } = req.params

        let user

        if(!validator.isEmail(value)) {
            user = await User.findById(value, clientSelect)
                .populate(clientPopulate)
            
        } else {
            user = await User.findOne({ email: value }, clientSelect)
                .populate(clientPopulate)
        }

        if(!user) throw 'user not found'

        res.status(200).send(user)
    } catch(e) {
        res.status(400).send(e)
    }
})

/** 
* manager update user
*/
ClientR.post(
'/client/attachsubscription/:unitId/:subscriptionId/:bagQuantity',
managerAuth,
async (req: Request<
    {
        unitId: string
        subscriptionId: string
        bagQuantity?: number
    }, {}, ManagerAuthI>, res: Response) => {
    try {
        const {
            unitId,
            subscriptionId,
        } = req.params
        let { bagQuantity } = req.params

        const aptId = extractUnitId(unitId)[0]
        const apt = await Apt.findOne({ aptId })
        if(!apt) throw 'apartment not found'

        if(!bagQuantity) bagQuantity = 1

        const unit = await apt.addSubscription(
            unitId, 
            subscriptionId,
            bagQuantity
        )


        res.status(200).send(unit)
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Remove subscription from client and unit
 */
ClientR.delete(
'/client/removesubscription/:unitId/:subscriptionId',
managerAuth,
async (req: Request<{unitId: string, subscriptionId: string}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { unitId, subscriptionId } = req.params
        const { manager } = req.body

        const aptId = extractUnitId(unitId)[0]
        const apt = await Apt.findOne({ aptId })
        if(!apt) throw 'apartment not found'

        if(!idToString(manager.masters).includes(apt.master.toString())) {
            err(401, 'unauthorized to this master')
        }

        const unit = await apt.removeSubscription(unitId, subscriptionId)

        res.status(200).send(unit)
    } catch(e) {
        res.status(400).send(e)
    }
}
)


export default ClientR