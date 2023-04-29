import { Router, Request, Response } from 'express'
import Master, { ClientPreferenceI } from '../../Models/master'
import { managerAuth, ManagerAuthI } from '../../middleware/auth'

const MasterR = Router()

MasterR.get(
'/list_areas',
managerAuth,
async (req: Request<{}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { isAdmin } = req.body

        if(!isAdmin) {
            res.status(401).send('not authorized')
            return
        }

        const masters = await Master.find()
        if(!masters) {
            res.status(500).send('unable to find masters')
            return
        }

        res.status(200).send(masters)
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

MasterR.get(
'/area/:masterId',
managerAuth,
async (req: Request<{ masterId: string }, {}, ManagerAuthI>, res: Response) => {
    try {
        const { masterId } = req.params
        const { isAdmin } = req.body

        if(!isAdmin) {
            res.status(401).send('not authorized')
            return
        }

        const master = await Master.findById(masterId)
        if(!master) {
            res.status(500).send('unable to find master')
            return
        }

        res.status(200).send(master)
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

interface addClientServiceI extends ManagerAuthI {
    title: string
    description: string
    type: ClientPreferenceI['type']
}

MasterR.post(
'/area/:masterId/add_client_service',
managerAuth,
async (req: Request<{ masterId: string }, {}, addClientServiceI>, res: Response) => {
    try {
        const { masterId } = req.params
        const { isAdmin, title, description, type } = req.body

        if(!isAdmin) {
            res.status(401).send('not authorized')
            return
        }

        const master = await Master.findById(masterId)
        if(!master) {
            res.status(500).send('unable to find master')
            return
        }

        await master.addClientPreference(
            title, 
            description,
            type
        )

        res.status(200).send('client service added')
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

MasterR.delete(
'/area/:masterId/remove_client_service/:serviceId',
managerAuth,
async (req: Request<{ masterId: string, serviceId: string }, {}, addClientServiceI>, res: Response) => {
    try {
        const { masterId, serviceId } = req.params
        const { isAdmin } = req.body

        if(!isAdmin) {
            res.status(401).send('not authorized')
            return
        }

        const master = await Master.findById(masterId)
        if(!master) {
            res.status(500).send('unable to find master')
            return
        }

        await master.removeClientPreference(serviceId)

        res.status(200).send('client service removed')
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

export default MasterR