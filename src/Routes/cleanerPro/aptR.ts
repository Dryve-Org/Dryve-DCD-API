import express, {
    Response,
    Request
} from 'express'
import { err, extractUnitId } from '../../constants/general'
import { cleanerProAuth, CleanerProAuthI } from '../../middleware/auth'
import Apt, { AptDocT } from '../../Models/aparmtent/apartment.model'
import { CleanerproAptPopulateToUnit, CleanerProAptSelect } from './constants'

const AptR = express.Router()

AptR.get(
'/apt/:aptId',
cleanerProAuth,
async (req: Request<{ aptId: string }, {}, CleanerProAuthI>, res: Response) => {
    try {
        //in the event that the aptId is a unitId
        const [ aptId ] = extractUnitId(req.params.aptId)

        let apt: AptDocT | null = null
        
        if(aptId) {
            apt = await Apt.findOne({ aptId }, CleanerProAptSelect)
                .populate(CleanerproAptPopulateToUnit)
        } else {
            apt = await Apt.findById(req.params.aptId, CleanerProAptSelect)
                .populate(CleanerproAptPopulateToUnit)
        }

        if(!apt) throw err(400, 'invalid apartment id')

        res.status(200).send(apt)
    } catch(e: any) {
        if (e.status && e.message) {
            res.status(e.status).send(e.message)
            return
        }
        res.status(500).send(e)
    }
})

AptR.get(
'/apt/unitId/:unitId',
cleanerProAuth,
async (req: Request<{unitId: string}, {}, CleanerProAuthI>, res: Response) => {
    try {
        const { unitId } = req.params
        const [ aptId ] = extractUnitId(unitId)

        const parseAptId = extractUnitId(aptId)
        let apt: AptDocT | null = null

        if(parseAptId[0]) {
            apt = await Apt.findOne({ aptId }, CleanerProAptSelect)
                .populate(CleanerproAptPopulateToUnit)
        } else {
            apt = await Apt.findById(aptId, CleanerProAptSelect)
                .populate(CleanerproAptPopulateToUnit)
        }

        if(!apt) throw err(400, 'invalid unit id')

        const unitData = apt.getUnitId(unitId)
        if(!unitData) throw err(400, 'invalid unit id')

        const [,,unit] = unitData

        res.status(200).send(unit)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
            return
        }
        res.status(500).send(e)
    }
})

export default AptR