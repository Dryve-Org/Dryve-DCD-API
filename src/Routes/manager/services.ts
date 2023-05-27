import {
    Router,
    Request,
    Response
} from 'express'
import Service from '../../Models/services.model'
import { ManagerAuthI, managerAuth } from '../../middleware/auth'

const ServicesR = Router()

ServicesR.get(
'/services',
managerAuth,
async (req: Request<{}, {}, ManagerAuthI>, res: Response) => {
    try {
        const {  } = req.body

        const services = await Service.find({})
    } catch(e: any) {
        if(e.message && e.status) {
            res.status(e.status).send(e.message)
            return
        } else {
            res.status(500).send(e)
            return
        }
    }
})

export default ServicesR