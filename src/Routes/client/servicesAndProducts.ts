import { Router, Request } from 'express'
import { auth, authBodyI } from '../../middleware/auth'
import { err, extractUnitId } from '../../constants/general'
import Apt from '../../Models/aparmtent/apartment.model'
import Master from '../../Models/master'

/**
 * Services and products route
*/
const SAPR = Router()

SAPR.get(
'/sap/list_saps/:unitId',
auth,
async (req: Request<{unitId: string}, {}, authBodyI>, res) => {
    try {
        const { user } = req.body
        const { unitId } = req.params

        const aptId = extractUnitId(unitId)[0]

        const apt = await Apt.findOne({ aptId: aptId })
        if(!apt) {
            throw err(400, 'invalid unit id')
        }

        const master = await Master.findById(apt.master, {
            servicesAndProducts: 1
        })
        .populate('servicesAndProducts')
        if(!master) {
            throw err(500, 'could not get master')
        }

        res.status(200).send(master.servicesAndProducts)
    } catch (e: any) {
        if(e.message && e.status) {
            return res.status(e.staus).send( e.message )
        } else {
            return res.status(500).send(e)
        }
    }
})

export default SAPR