import { Router, Request } from 'express'
import { auth, authBodyI } from '../../middleware/auth'
import { extractUnitId } from '../../constants/general'
import Apt from '../../Models/aparmtent/apartment.model'

const preferencesR = Router()

preferencesR.get(
'/preference_options',
auth,
async (req: Request<{}, {}, authBodyI>, res) => {
    try {
        const { user } = req.body

        const aptIds = user.attachedUnitIds.map(uid => extractUnitId(uid)[0])

        const apts = await Apt.find({ aptId: aptIds })
        
        res.status(200).send(apts)
    } catch (e: any) {
        if(e.message && e.status) {
            return res.status(e.staus).send( e.message )
        } else {
            return res.status(500).send(encodeURI)
        }
    }
})

export default preferencesR