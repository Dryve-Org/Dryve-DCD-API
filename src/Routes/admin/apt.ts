import { 
    Router,
    Request,
    Response
} from 'express'
import { ManagerAuthI, managerAuth } from '../../middleware/auth'
import Apt from '../../Models/aparmtent/apartment.model'
import Master from '../../Models/master'

const aptR = Router()

aptR.post(
'/:aptId/update_attached_master/:masterId',
managerAuth,
async (req: Request<{ aptId: string, masterId: string }, {}, ManagerAuthI>, res) => {
    try {
        const { aptId, masterId } = req.params
        const { manager, isAdmin } = req.body

        if(!isAdmin) {
            return res.status(401).send('not authorized')
        }

        const apt = await Apt.findById(aptId)
        if(!apt) {
            res.status(400).send('could not find apartment')
            return
        }

        const master = await Master.findById(masterId)
        if(!master) {
            res.status(400).send('could not find master')
            return
        }

        await apt.updateMaster(masterId)
    
        res.status(200).send(
            `${apt.name} is now attached to ${masterId}`
        )
    } catch(e: any) {
        if(e.status && e.message) {
            return res.status(e.status).send(e.message)
        } else {
            return res.status(500).send(e)
        }
    }
})

export default aptR