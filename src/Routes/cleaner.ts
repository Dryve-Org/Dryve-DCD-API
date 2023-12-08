import { Response, Request, Router } from 'express'
import { addAddress } from '../constants/location'
import { auth, authBodyI, CleanerProAuthI, managerAuth } from '../middleware/auth'
import Address, { AddressI } from '../Models/address.model'
import validator from 'validator'
import Cleaner from '../Models/cleaner.model'
import { servicesExist } from '../constants/validation'
import { ServiceI } from '../Models/services.model'

const cleanerRouter = Router()

interface PostCleanerI extends authBodyI { //will be auth manager
    name: string
    phoneNumber: string,
    email: string
    address: AddressI
    cardId: string
    services?: string[]
    website?: string
}

//edit: complete this later
cleanerRouter.post('/', managerAuth, async (req: Request<{}, {}, PostCleanerI>, res: Response) => {
    try {
        const {
            name,
            phoneNumber,
            email,
            address,
            website,
            cardId,
            services
        } = req.body
        //// quick validation ////
        if(!name) throw 'name required'
        if(!validator.isMobilePhone(phoneNumber)) throw 'invalid phoneNumber'
        if(!validator.isEmail(email)) throw 'invalid email'

        if(website) {
            if(!validator.isURL(website)) throw 'invalid url'
        }
        //validating and adding Address
        const addy = await addAddress(address)

        if(services) {
            const isServices = await servicesExist(services)
            if(!isServices) throw 'invalid services'
        }

        const cleaner = new Cleaner({
            name,
            email,
            address: addy._id,
            services,
            phoneNumber
        })

        cleaner.save()
        res.status(200).send(cleaner)
    } catch (e: any) {
        res.status(400).send(e)
    }
})



export default cleanerRouter