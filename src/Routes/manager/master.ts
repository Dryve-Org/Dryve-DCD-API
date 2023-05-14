import { 
    Router,
    Response,
    Request
} from 'express'
import { ManagerAuthI, managerAuth } from '../../middleware/auth'
import Master from '../../Models/master'
import { err } from '../../constants/general'
import { manMasterSelect } from './constants/masterOutput'

const MasterR = Router()

MasterR.get(
'/masters',
managerAuth, 
async (req: Request<{}, {}, ManagerAuthI>, res: Response) => {
    try {
        const master = await Master.find({}, manMasterSelect)
        if(!master) {
            throw err(500, 'unable to find masters')
        }

        res.send(master)
    } catch (e: any) {
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
'/master/:id',
managerAuth, 
async (req: Request<{id: string}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { id } = req.params

        const master = await Master.findById(id, manMasterSelect)
        if(!master) {
            throw err(500, 'unable to find masters')
        }

        res.send(master)
    } catch (e: any) {
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
'/master/:id/clientPreferences',
managerAuth, 
async (req: Request<{id: string}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { id } = req.params

        const master = await Master.findById(id, {
            clientPreferences: 1
        })
        if(!master) {
            throw err(500, 'unable to find masters')
        }

        res.send(master.clientPreferences)
    } catch (e: any) {
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