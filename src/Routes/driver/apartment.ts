import express, { Request, Response } from 'express'
import { err, extractUnitId } from '../../constants/general'
import { driverAuth, DriverAuthI } from '../../middleware/auth'
import Apt, { AptDocT, AptI } from '../../Models/aparmtent/apartment.model'
import Driver from '../../Models/driver.model'
import { AptToUnitI } from '../interface'
import AptR from '../manager/apartment'
import { driveAptPopulateToUnit, driverAptPopulate, driverAptSelect } from './constants'

const aptR = express.Router()

const populateBldAddress = {
    path: 'buildings.$*.address',
    model: 'Address'
}

/** 
 * This is a mongoose populate object. It is used to populate the address field in the unit model. 
*/
const populateUnitAddress = {
    path: 'buildings.$*.units.$*.address',
    model: 'Address'
}

/**  
 * This is a mongoose populate object. It is used to populate the client field in the unit model. 
*/
const populateUnitClient = {
    path: 'buildings.$*.units.$*.client',
    model: 'User',
    select: {
        firstName: 1,
        lastName: 1,
        phoneNumber: 1,
        email: 1
    }
}

/**
 * What the Driver should not see in apartment order data
*/
const sensitive = {
    'paidFor': 0,
    'createBy': 0,
    'orderFee': 0,
    'orderFeePaid': 0,
    'userCard': 0
}


/** 
 * Populating the activeOrder field in the unit model. 
*/
const populateUnitOrder = [
    {
        path: 'buildings.$*.units.$*.activeOrder',
        model: 'Order',
        populate: [
            {
                path: 'client',
                model: 'User',
                select: {
                    firstName: 1,
                    lastName: 1,
                    phoneNumber: 1
                }
            },
            {
                path: 'cleaner',
                model: 'Cleaner',
                select: {
                    name: 1,
                    email: 1,
                    phoneNumber: 1,
                }
            },
            {
                path: 'cleanerAddress',
                model: 'Address'
            },
            {
                path: 'origin',
                model: 'Address'
            },
            {
                path: 'dropOffAddress',
                model: 'Address'
            },
            {
                path: 'pickUpDriver',
                model: 'Driver',
                select: {
                    user: 1,
                },
                populate: {
                    path: 'user',
                    model: 'User',
                    select: {
                        firstName: 1,
                        lastName: 1,
                        phoneNumber: 1
                    }
                }
            },
            {
                path: 'apartment',
                model: 'Apartment',
                select: {
                    name: 1,
                    address: 1,
                    goToCleaner: 1,
                    primaryCleaner: 1
                }
            }
        ],
        select: sensitive
    },
]


/*
    Get Aparmtents
    //edit: this should be nearby Apartments
*/
aptR.get(
'/apartments',
driverAuth,
async (req: Request<{}, {}, DriverAuthI>, res: Response) => {
    try {
        const apts = await Apt.find({}, driverAptSelect)
            .populate(driverAptPopulate)

        if(!apts) {
            res.status(500).send('unable to get aparments')
            return
        }
        
        res.status(200).send(apts)

    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Get Apartment
*/
aptR.get(
'/apartment/:aptId',
driverAuth,
async (req: Request<AptToUnitI, {}, DriverAuthI>, res: Response) => {
    try {
        const [ aptId ] = extractUnitId(req.params.aptId)

        let apt: AptDocT | null = null
        
        if(aptId) {
            apt = await Apt.findOne({ aptId }, driverAptSelect)
                .populate(driveAptPopulateToUnit)
        } else {
            apt = await Apt.findById(req.params.aptId, driverAptSelect)
                .populate(driveAptPopulateToUnit)
        }

        if(!apt) throw err(400, 'invalid apartment id')

        res.status(200).send(apt)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Get Queued Orders
*/
aptR.get(
'/apartment/:aptId/order_queue',
driverAuth,
async (req: Request<AptToUnitI, {}, DriverAuthI>, res: Response) => {
    try {
        const { aptId } = req.params

        const apt = await Apt.findById(aptId, driverAptSelect)
            .populate(driveAptPopulateToUnit)
        if(!apt) throw err(400, 'unable to find apartment')

        const units = apt.queuedUnits()

        res.status(200).send(units)
    } catch (e) {

    }
})

/*
    get unit by unitId
*/
aptR.get(
'/apartment/unitId/:unitId',
driverAuth,
async (req: Request<{unitId: string}, {}, DriverAuthI>, res: Response) => {
    try {
        const [ aptId ] = extractUnitId(req.params.unitId)

        let apt: AptDocT | null = null
        
        if(aptId) {
            apt = await Apt.findOne({ aptId }, driverAptSelect)
                .populate(driveAptPopulateToUnit)
        } else {
            apt = await Apt.findById(req.params.unitId, driverAptSelect)
                .populate(driveAptPopulateToUnit)
        }

        if(!apt) throw err(400, 'invalid apartment id')

        const unitData = apt.getUnitId(req.params.unitId)
        if(!unitData) throw err(400, 'invalid unit id')

        const [,, unit] = unitData

        res.status(200).send(unit)
    } catch(e: any) {
        if(e.status && e.message) {
            res.status(e.status).send(e.message)
        } else {
            res.status(500).send(e)
        }
    }
})

/*
    Get Apartment Building
*/
aptR.get(
'/apartment/:aptId/:bldId',
driverAuth,
async (req: Request<AptToUnitI, {}, DriverAuthI>, res: Response) => {
    try {
        const [ aptId ] = extractUnitId(req.params.aptId)
        const bldId = req.params.bldId

        let apt: AptDocT | null = null
        
        if(aptId) {
            apt = await Apt.findOne({ aptId }, driverAptSelect)
                .populate(driveAptPopulateToUnit)
        } else {
            apt = await Apt.findById(req.params.aptId, driverAptSelect)
                .populate(driveAptPopulateToUnit)
        }

        if(!apt) throw err(400, 'invalid apartment id')

        const building = apt.buildings.get(bldId)
        if(!building) throw 'invalid params'

        res.status(200).send(building)
    } catch(e) {
        res.status(400).send(e)
    }
})

/*
    Active Units in building
*/
aptR.get(
'/apartment/:aptId/:bldId/active_units',
driverAuth,
async (req: Request<AptToUnitI, {}, DriverAuthI>, res: Response) => {
    try {
        const { aptId, bldId } = req.params

        const apt = await Apt.findById(aptId)
            .populate([
                populateBldAddress,
                populateUnitAddress,
                populateUnitClient,
                {
                    path: 'address',
                    model: 'Address'
                },
            ])
            .select(sensitive)

        if(!apt) throw 'invalid params'

        const unitsMap = apt.buildings.get(bldId)?.units
        if(!unitsMap) throw 'invalid params'

        unitsMap
            .forEach((unit, key) => {
                if(!unit.isActive) {
                    unitsMap.delete(key)
                }
            })

        res.status(200).send(unitsMap)
    } catch(e) {
        res.status(400).send(e)
    }
})



/*
    Get unit
*/
aptR.get(
'/apartment/:aptId/:bldId/:unitId',
driverAuth,
async (req: Request<AptToUnitI, {}, DriverAuthI>, res: Response) => {
    try {
        const { aptId, bldId, unitId } = req.params

        const apt = await Apt.findById(aptId)
            .populate([
                populateBldAddress,
                populateUnitAddress,
                populateUnitClient,
                ...populateUnitOrder,
                {
                    path: 'address',
                    model: 'Address'
                },
            ])
            .select(sensitive)

        if(!apt) throw 'invalid params'

        const unit = apt.buildings.get(bldId)?.units.get(unitId)
        if(!unit) throw 'invalid params'

        res.status(200).send(unit)
    } catch(e) {
        res.status(400).send(e)
    }
})





export default aptR