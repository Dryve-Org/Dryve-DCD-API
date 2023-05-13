import { Router, Request } from 'express'
import { auth, authBodyI } from '../../middleware/auth'
import { err, extractUnitId, idToString } from '../../constants/general'
import Apt from '../../Models/aparmtent/apartment.model'
import _ from 'lodash'
import Master, { MasterI } from '../../Models/master'

const preferencesR = Router()

preferencesR.get(
'/preference_options',
auth,
async (req: Request<{}, {}, authBodyI>, res) => {
    try {
        const { user } = req.body

        const aptIds = user.attachedUnitIds.map(uid => extractUnitId(uid)[0])

        const apts = await Apt.find({ aptId: aptIds })
            .catch(() => {
                throw err(500, 'could not get apartments')
            })
        if(apts.length === 0) {
            res.status(200).send('not attached to an apartment')
        }

        const uniqueMasters = _.uniqBy(apts, 'master')

        const masters = await Master.find({ 
                _id: {$in: uniqueMasters.map(apt => apt.master) }
            },
            { clientPreferences: 1 }
        )

        const clientPreferences = apts.map(apt => ({
            _id: apt.id,
            name: apt.name,
            clientPreferences: masters.filter(master => apt.master.toString() === master.id)[0].clientPreferences
        }))
        
        res.status(200).send(clientPreferences)
    } catch (e: any) {
        if(e.message && e.status) {
            return res.status(e.staus).send( e.message )
        } else {
            return res.status(500).send(e)
        }
    }
})

interface AddPreferenceI extends authBodyI {
    preferences: string[]
}

preferencesR.post(
'/add_preferences',
auth,
async (req: Request<{}, {}, AddPreferenceI>, res) => {
    try {
        const { user, preferences } = req.body

        const updatedUser = await user.addPreferences(preferences)

        res.status(200).send(updatedUser)
    } catch(e: any) {
        if(e.message && e.status) {
            return res.status(e.staus).send( e.message )
        } else {
            return res.status(500).send(e)
        } 
    }
})

preferencesR.delete(
'/remove_preference/:preference',
auth,
async (req: Request<{preference: string}, {}, authBodyI>, res) => {
    try {
        const { user } = req.body
        const { preference } = req.params

        const updatedUser = await user.removePreference(preference)

        res.status(200).send(updatedUser)
    } catch(e: any) {
        if(e.message && e.status) {
            return res.status(e.staus).send( e.message )
        } else {
            return res.status(500).send(e)
        } 
    }
})

export default preferencesR