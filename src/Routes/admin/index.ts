import express from 'express'
import MasterR from './master'
import AptR from './apt'
import ManagerR from './manager'
import CleanerR from './cleaner'
import Managers from '../../Models/manager.models'

const adminRouter = express.Router()

adminRouter.get('/save_admin', async (req, res) => {
    try {
        const admins = await Managers.find({ isAdmin: true })

        for(let i = 0; i < admins.length; i++) {
            await admins[i].save()
        }

        res.status(200).send('saved all admins')
    } catch(e) {
        res.status(500).send('could not save admin')
    }
})

adminRouter.use('/master', MasterR)
adminRouter.use('/apt', AptR)
adminRouter.use('/manager', ManagerR)
adminRouter.use('/cleaner', CleanerR)

export default adminRouter