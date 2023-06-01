import { Router, Request } from 'express'
import { auth, authBodyI } from '../../middleware/auth'
import { err, extractUnitId, idToString } from '../../constants/general'
import Apt from '../../Models/aparmtent/apartment.model'
import _ from 'lodash'
import Master, { MasterI } from '../../Models/master'
import SAP from '../../Models/ServicesAndProducts'

const SAPR = Router()

SAPR.get(
'/sap/options/:unitId',
auth,
async (req: Request<{ unitId: string }, {}, authBodyI>, res) => {
    try {
        const { user } = req.body
        const { unitId } = req.params

        const aptId = extractUnitId(unitId)[0]

        if(user.attachedUnitIds.indexOf(unitId) === -1) {
            throw err(400, 'not attached to this unit')
        }

        const apt = await Apt.findOne(
            { aptId: aptId },
            { servicesAndProducts: 1 }
        ).populate('servicesAndProducts')
        if(!apt) {
            throw err(400, 'could not find apartment')
        }

        res.status(200).send(apt.servicesAndProducts)
    } catch (e: any) {
        if(e.message && e.status) {
            return res.status(e.staus).send( e.message )
        } else {
            return res.status(500).send(e)
        }
    }
})

export default SAPR