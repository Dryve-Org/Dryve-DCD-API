import express, { Request, Response } from 'express'
import { addAddress } from '../../constants/location'
import { cleanerProAuth, managerAuth, ManagerAuthI } from '../../middleware/auth'
import Address, { AddressI } from '../../Models/address.model'
import Cleaner from '../../Models/cleaner.model'
import v from 'validator'
import Service, { ServiceI } from '../../Models/services.model'


const cleanerR = express.Router()

interface AddCleanerI extends ManagerAuthI {
    name: string
    address: AddressI
    phoneNumber: string
}

/**
 * Create a cleaner
 * *NOT TESTED
*/ 
cleanerR.post(
'/cleaner/add_cleaner',
managerAuth,
async (req: Request<{}, {}, AddCleanerI>, res: Response) => {
    try {
        const {
            address,
            name,
            phoneNumber
        } = req.body
    
        if(!v.isMobilePhone(phoneNumber)) {
            throw 'invalid phone number'
        }
    
        const addy = await addAddress(address)
            .catch(() => {
                throw 'address error'
            })
    
        const cleaner = await Cleaner.create({
            name,
            address: addy._id,
            phoneNumber
        })

        cleaner.save()
            .then(() => {
                res.status(200).send(cleaner)
            })
            .catch(() => {
                res.status(500).send(
                    'unable to save new cleaner'
                )
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface updateClnAddress extends ManagerAuthI {
    address: AddressI
} 

/* Updating the address of a cleaner. */
cleanerR.put(
'/cleaner/update_address/:clnId',
managerAuth,
async (req: Request<{ clnId: string }, {}, updateClnAddress>, res: Response) => {
    try {
        const { clnId } = req.params
        const { address } = req.body

        const addy = await addAddress(address)
            .catch(() => {
                throw 'invalid address'
            })
        
        const cln = await Cleaner.findById(clnId)
        if(!cln) throw 'invalid cleanerId'

        cln.address = addy._id

        cln.populate('address')

        cln.save()
            .then(() => {
                res.status(200).send(cln)
            })
            .catch(() => {
                res.status(400).send(
                    'unable to save updated cleaner address'
                )
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface AddServiceI extends ManagerAuthI {
    service: ServiceI
}

cleanerR.post(
'/cleaner/:clnId/add_service',
managerAuth,
async (req: Request<{ clnId: string }, {}, AddServiceI>, res: Response) => {
    try {
        const { clnId } = req.params
        const { service } = req.body

        const cleaner = await Cleaner.findById(clnId)
        
        if(!cleaner) {
            throw 'invalid cleaner id'
        }

        const svc = await Service.create({
            title: service.title,
            description: service.description,
            price: service.price
        })
        .catch((e) => { console.log(e); throw e })

        await svc.save()
            .catch((e) => {
                console.error('unable to save service', e)
                throw 'unable to save new service'
            })
        

        cleaner.services.push(svc._id)

        cleaner.save()
            .then(() => {
                res.status(200).send(cleaner)
            })
            .catch((e) => {
                console.error('unable to save cleaner', e)
                res.status(500)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

export default cleanerR