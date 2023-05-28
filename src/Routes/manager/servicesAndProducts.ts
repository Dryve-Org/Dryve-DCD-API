import {
    Router,
    Request,
    Response
} from 'express'
import Service from '../../Models/services.model'
import { ManagerAuthI, managerAuth } from '../../middleware/auth'
import { err } from '../../constants/general'
import SAP from '../../Models/ServicesAndProducts'
import Master from '../../Models/master'

/**
 * manager routes for services and products
*/
const SapR = Router()

interface CreateSAPI extends ManagerAuthI {
    name: string
    description: string
    masterId: string
}

SapR.post(
'/SAP/CreateSAP', 
managerAuth, 
async (req: Request<{}, {}, CreateSAPI>, res: Response) => {
    try {
        const { 
            name, 
            description,
            masterId,
            isAdmin
        } = req.body

        if(!isAdmin) {
            err(401, 'not authorized to create a services or products schema')
        }

        const newSAP = await SAP.create({
            name,
            description
        })

        const master = await Master.findById(masterId ? masterId : '000000000000000000000000')
            
        if(masterId && !master) {
            throw err(400, 'master id provided is not valid')
        }

        if(master) {
            master.servicesAndProducts.push(newSAP._id)
            await master.save()
        }

        const onFail = async () => {
            await newSAP.delete()

            if(master) {
                master.servicesAndProducts = master.servicesAndProducts.filter(
                    sap => sap.id !== newSAP.id
                )
                await master.save()
            }

            throw err(500, `
                failed to create a new services and products schema. Cannot create an SAP with the same name as another SAP
            `)
        }

        await newSAP.save()
            .catch(onFail)

        res.status(201).send(newSAP)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        } else {
            res.status(500).send(e)
        }
    }
})

export default SapR