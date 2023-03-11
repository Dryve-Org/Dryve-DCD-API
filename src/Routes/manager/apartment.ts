import express, { Request, Response } from 'express'
import _ from 'lodash'
import { Types } from 'mongoose'
import { addAddress, getDistanceById } from '../../constants/location'
import { managerAuth, ManagerAuthI } from '../../middleware/auth'
import Address, { AddressDocT, AddressI } from '../../Models/address.model'
import Apt, { AptBuildingI, AptI } from '../../Models/aparmtent/apartment.model'
import Manager from '../../Models/manager.models'
import User from '../../Models/user.model'
import ManagerR from './manager'
import v from 'validator'
import { AptToUnitI } from '../interface'
import Cleaner from '../../Models/cleaner.model'
import { idToString } from '../../constants/general'

const AptR = express.Router()

interface AddAptI extends ManagerAuthI {
    name: string
    address: AddressI
}

/*
    Get apartment information by id
*/
AptR.get(
'/apartment/:aptId',
ManagerR,
async (req: Request<{aptId: string}, {}, ManagerAuthI>, res: Response) => {
    try {
        const { aptId } = req.params

        const apt = await Apt.findById(aptId)
            .populate('address')
        if(!apt) {
            throw 'invalid apartment id'
        }

        res.status(200).send(apt)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Add an Apartment
*/
AptR.post(
'/apartment/add',
managerAuth,
async (req: Request<{}, {}, AddAptI>, res: Response) => {
    try {
        const { 
            name,
            address
        } = req.body
        /// Validation ///
        if(!name || !address) throw 'invalid body'

        const addy = await addAddress(address)
            .catch(() => { 
                throw 'invalid body'
            })

        const apt = new Apt({
            name,
            address: addy
        })

        await apt.save()
            .then(() => {
                res.status(200).send(apt)
            })
            .catch(() => {
                res.status(500).send('unable to store new apartment')
            })

    } catch(e) {
        res.status(400).send(e)
    }
})

interface AddPrimCln extends ManagerAuthI {
    cleanerId: string
    overrideDistance: boolean
}

/**
 * Add a primary cleaner
*/
AptR.post(
'/apartment/:aptId/add_primary_cleaner',
managerAuth,
async (req: Request<AptToUnitI, {}, AddPrimCln>, res: Response) => {
    try {
        const { aptId } = req.params
        const { cleanerId, overrideDistance } = req.body

        const apt = await Apt.findById(aptId)
        if(!apt) throw 'invalid apartment Id'

        const cleaner = await Cleaner.findById(cleanerId)
        if(!cleaner) throw 'invalid cleaner id'

        if(apt.primaryCleaner?.toString() === cleaner.id) throw 'already a primary cleaner'

        if(!overrideDistance) {
            const distance = await getDistanceById(apt.address, cleaner.address)
            if(distance.distanceInMeters > 32_186.9) throw `${cleaner.name} is too far`
        }

        apt.primaryCleaner = cleaner._id
        
        if(!idToString(apt.goToCleaners).includes(cleanerId)) {
            apt.goToCleaners.push(cleaner._id)
        }

        await apt.save()
            .then(() => {
                res.status(200).send(apt)
            })
            .catch(e => {
                res.status(500).send('unable to save updated apartment')
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Add a cleaner
*/
AptR.post(
'/apartment/:aptId/add_cleaner',
managerAuth,
async (req: Request<AptToUnitI, {}, AddPrimCln>, res: Response) => {
    try {
        const { aptId } = req.params
        const { cleanerId, overrideDistance } = req.body

        const apt = await Apt.findById(aptId)
        if(!apt) throw 'invalid apartment Id'

        const cleaner = await Cleaner.findById(cleanerId)
        if(!cleaner) throw 'invalid cleaner id'

        if(idToString(apt.goToCleaners).includes(cleanerId)) throw 'This cleaner is already attached to apartment' 

        if(!overrideDistance) {
            const distance = await getDistanceById(apt.address, cleaner.address)
            if(distance.distanceInMeters > 32_186.9) throw `${cleaner.name} is too far`
        }

        apt.goToCleaners.push(cleaner._id)

        await apt.save()
            .then(() => {
                res.status(200).send(apt)
            })
            .catch((e) => {
                res.status(500).send(e)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface AddBuildings extends ManagerAuthI {
    building: string,
    address: AddressI
    units: string[]
}

/*
    Add building to aparment found by id
*/
AptR.put(
'/apartment/:aptId/add_building',
ManagerR,
async (req: Request<{aptId: string}, {}, AddBuildings>, res: Response) => {
    try {
        const { aptId } = req.params
        const { 
            building,
            address,
            units 
        } = req.body

        if(!address || !building) throw 'invalid body'

        //edit: There's no way to validate buildings

        const apt = await Apt.findById(aptId).populate('buildings.$*')
        if(!apt) {
            throw 'invalid apartment id'
        }

        
        if(apt.buildings) {
            if(apt.buildings.get(building)) throw 'building already exists'
        }

        const savedApt = await apt.addBuilding(
            building,
            address,
            units
        )

        res.status(200).send(savedApt)
    } catch(e) {
        res.status(400).send(e)
    }
})

interface AddUnitI extends ManagerAuthI {
    clientId?: string
    unit: string
    isActive: boolean
}

/*
    adds a unit to apartment building
*/
AptR.put(
'/apartment/:aptId/:bld/add_unit',
managerAuth,
async (req: Request<{
    aptId: string
    bld: string    
}, {}, AddUnitI>, res: Response) => {
    try {
        const { aptId, bld } = req.params
        const { unit } = req.body

        /* body validation */
        if(typeof unit !== 'string') throw 'invalid body'
        
        const apt = await Apt.findById(aptId)
        if(!apt) throw 'invalid params'
        if(!apt.buildings.get(bld)) throw 'invalid params'
        apt.buildings.toObject()

        apt.addUnit(bld, unit)
            .then(() => {
                res.status(200).send(apt)
            })
            .catch((e: { message: string, status: number }) => {
                res.status(e.status).send(e.message)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface AddUnitsI extends ManagerAuthI {
    units: string[]
}

/*
    adds units to apartment building
*/
AptR.put(
'/apartment/:aptId/:bld/add_units',
managerAuth,
async (req: Request<{
    aptId: string
    bld: string    
}, {}, AddUnitsI>, res: Response) => {
    try {
        const { aptId, bld } = req.params
        const { units } = req.body

        /* body validation */
        if(typeof units !== 'object') throw 'invalid body'
        
        //get apartment
        const apt = await Apt.findById(aptId)
        if(!apt) throw 'invalid params'
        //throw if building does not exist
        if(!apt.buildings.get(bld)) throw 'invalid params'
        
        apt.addUnits(bld, units)
            .then(() => {
                res.status(200).send(apt)
            })
            .catch((e: { message: string, status: number }) => {
                res.status(e.status).send(e.message)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

interface AddClientToUnit extends ManagerAuthI {
    email: string
    isActive?: boolean
}

/*
    add client to unit
    * is active will default to false if not provided
*/
AptR.put(
'/apartment/:aptId/:bldId/:unitId/add_client',
managerAuth,
async (req: Request<AptToUnitI, {}, AddClientToUnit>, res: Response) => {
    try {
        const {
            aptId,
            bldId,
            unitId
        } = req.params

        const {
            email,
            isActive
        } = req.body

        if(!v.isEmail(email)) throw 'invalid body'
        if(isActive) {
            if(typeof isActive !== 'boolean') throw 'invalid body'
        }

        const apt = await Apt.findById(aptId)
        if(!apt) throw 'invalid apartment Id'

        const unit = apt.buildings.get(bldId)?.units.get(unitId)
        if(!unit) throw 'unit does not exist'

        apt.addClient(bldId, unitId, email, isActive)
            .then(() => {
                res.status(200).send(apt)
            })
            .catch((e: {status: number, message: string}) => {
                res.status(e.status).send(e.message)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 *  Activate Unit
 * 
*/
AptR.put(
'/apartment/:aptId/:bldId/:unitId/activate_unit',
managerAuth,
async (req: Request<AptToUnitI, {}, ManagerAuthI>, res: Response) => {
    try {
        const {
            aptId,
            bldId,
            unitId
        } = req.params

        const apt = await Apt.findById(aptId)
        if(!apt) throw 'invalid params'

        apt.activateUnit(bldId, unitId)
            .then(data => {
                res.status(200).send(data)
            })
            .catch(e => {
                res.status(e.status).send(e.message)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

/**
 * Remove client from a unit
 */
AptR.delete(
'/apartment/:aptId/:bldId/:unitId/remove_client',
managerAuth,
async (req: Request<AptToUnitI, {}, ManagerAuthI>, res: Response) => {
    try {
        const { 
            aptId,
            bldId,
            unitId
        } = req.params

        const apt = await Apt.findById(aptId)
        if(!apt) throw 'invalid apartment id'

        apt.removeClient(bldId, unitId)
            .then(() => {
                res.status(200).send(apt)
            })
            .catch(e => {
                res.status(e.status).send(e.message)
            })
    } catch(e) {
        res.status(400).send(e)
    }
})

export default AptR