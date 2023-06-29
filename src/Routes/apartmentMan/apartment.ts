import express, { Request, Response } from 'express'
import Apartment, { UnitI } from '../../Models/aparmtent/apartment.model'
import { aptManAuthI, aptManAuth } from '../../middleware/auth'
import { extractUnitId, idToString } from '../../constants/general'
import Apt from '../../Models/aparmtent/apartment.model'
import Address from '../../Models/address.model'
import { ClientSelect } from './constant/outputs'
import User from '../../Models/user.model'
import { AptParams } from './constant/interface'

const AptR = express.Router()

const getApt = async (aptId: string) => {
    const apt = await Apartment.findById(
        aptId,
        {
            password: 0
        }
    )
    if(!apt) {
        return null
    }

    return apt
}

/**
 * @desc: get apartment data
 * @route: GET /aptMan/apt/:aptId
 * @access: private
 * 
*/
AptR.get(
'/:aptId',
aptManAuth,
async (req: Request<{aptId: string}, {}, aptManAuthI>, res: Response) => {
    try {
        const { aptId } = req.params
        const { aptMan } = req.body

        if(!idToString(aptMan.attachedApts).includes(aptId)) {
            return res.status(400).send('Unauthorized')
        }

        const apt = await getApt(aptId)
    
        res.send(apt)
    } catch(e) {
        res.status(400).send('Invalid inputs')
    }
})

/**
    * @desc: get apartment building by id
    * @route: GET /aptMan/apt/:aptId/:bldId
    * @access: private
*/
AptR.get(
'/:aptId/:bldId',
aptManAuth,
async (req: Request<AptParams, {}, aptManAuthI>, res: Response) => {
    try {
        const { aptId, bldId } = req.params
        const { aptMan } = req.body

        if(!idToString(aptMan.attachedApts).includes(aptId)) {
            return res.status(400).send('Unauthorized')
        }

        const apt = await Apt.findById(aptId, {buildings: 1})
        if(!apt) {
            return res.status(400).send('Invalid apartment')
        }

        const building = apt.getBuilding(bldId)

        const bldAddress = await Address.findById(building.address)
        if(!bldAddress) {
            return res.status(400).send('Invalid building')
        }

        //@ts-ignore
        building.address = bldAddress
    
        res.send(building)
    } catch(e) {
        res.status(400).send('Invalid inputs')
    }
})

/**
 * @desc: get apartment unit by id
 * @route: GET /aptMan/apt/:aptId/:bldId/:unitId
 * @access: private
*/
AptR.get(
'/:aptId/:bldId/:unitId',
aptManAuth,
async (req: Request<{aptId: string, bldId: string, unitId: string}, {}, aptManAuthI>, res: Response) => {
    try {
        const { aptId, bldId, unitId } = req.params
        const { aptMan } = req.body
        
        if(!idToString(aptMan.attachedApts).includes(aptId)) {
            return res.status(400).send('Unauthorized')
        }
        
        const apt = await Apt.findById(aptId)
        if(!apt) {
            return res.status(400).send('Invalid apartment')
        }

        const unit = apt.getUnit(bldId, unitId)

        const address = await Address.findById(unit.address)
        if(!address) {
            return res.status(400).send('Invalid unit')
        }

        if (unit.client) {
            const client = await User.findById(unit.client, ClientSelect)
            if(!client) {
                return res.status(400).send('Invalid unit')
            }
            //@ts-ignore
            unit.client = client
        }
        
        res.send(unit)
    } catch(e) {
        res.status(400).send('Invalid inputs')
    }
})

interface assignUnitI extends aptManAuthI {
    clientEmail: string
}

/**
 * @desc: assign unit to client
 * @route: POST /aptMan/apt/:aptId/:bldId/:unitId/assign
 * @access: private
 */
AptR.post(
'/:unitId/assign',
aptManAuth,
async (req: Request<{ unitId: UnitI['unitId'] }, {}, assignUnitI>, res: Response) => {
    try {
        const { unitId } = req.params
        const { clientEmail } = req.body
        const { aptMan } = req.body

        const [ aptId ] = extractUnitId(unitId)

        const apt = await Apt.findOne({aptId})
        if(!apt) {
            return res.status(400).send('Invalid apartment')
        }

        if(!idToString(aptMan.attachedApts).includes(apt.id)) {
            return res.status(401).send('Unauthorized to access this apartment')
        }

        

        await apt.addClient(unitId, clientEmail)

        res.send('Unit assigned')
    } catch(e) {
        res.status(400).send(e)
    }
})

AptR.delete(
'/:unitId/unassign/',
aptManAuth,
async (req: Request<{ unitId: UnitI['unitId'] }, {}, assignUnitI>, res: Response) => {
    try {
        const { unitId } = req.params
        const { clientEmail, aptMan } = req.body

        const [ aptId ] = extractUnitId(unitId)

        const apt = await Apt.findOne({aptId})
        if(!apt) {
            return res.status(400).send('Invalid apartment')
        }

        if(!idToString(aptMan.attachedApts).includes(apt.id)) {
            return res.status(401).send('Unauthorized to access this apartment')
        }

        await apt.removeClient(unitId, clientEmail)

        res.send('Unit unassigned')
    } catch(e) {
        res.status(400).send(e)
    }
})

AptR.post(
'/:aptId/:bldId/:unitId/activate',
aptManAuth,
async (req: Request<AptParams, {}, assignUnitI>, res: Response) => {
    try {
        const { aptId, bldId, unitId } = req.params

        const { aptMan } = req.body

        if(!idToString(aptMan.attachedApts).includes(aptId)) {
            return res.status(401).send('Unauthorized to access this apartment')
        }
 
        const apt = await Apt.findById(aptId)
        if(!apt) {
            return res.status(400).send('Invalid apartment')
        }

        await apt.activateUnit(bldId, unitId)

        res.status(200).send('Unit activated')
    } catch(e) {
        res.status(400).send(e)
    }
})

AptR.post(
'/:aptId/:bldId/:unitId/deactivate',
aptManAuth,
async (req: Request<AptParams, {}, assignUnitI>, res: Response) => {
    try {
        const { aptId, bldId, unitId } = req.params
        const { aptMan } = req.body

        if(!idToString(aptMan.attachedApts).includes(aptId)) {
            return res.status(401).send('Unauthorized to access this apartment')
        }

        const apt = await Apt.findById(aptId)
        if(!apt) {
            return res.status(400).send('Invalid apartment')
        }

        await apt.deactivateUnit(bldId, unitId)

        res.status(200).send('Unit deactivated')
    } catch(e) {
        res.status(400).send(e)
    }
})


export default AptR