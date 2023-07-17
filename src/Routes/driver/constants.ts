import User from "../../Models/user.model"

export const driverOrderSelect = {
    orderTotal: 0,
    serviceCost: 0,
    orderFee: 0,
    userCard: 0,
    paymentLinkId: 0
}

export const driverCleanerSelect = {
    name: 1,
    email: 1,
    phoneNumber: 1,
    website: 1,
    services: 1,
    activeOrders: 1
}

export const driverClientSelect = {
    firstName: 1,
    lastName: 1,
    phoneNumber: 1,
    email: 1,
    attachedUnitIds: 1,
    activeOrders: 1,
    preferences: 1
}

const orderDriversSelect = {
    user: 1,
}

const orderDriversPopulate = {
    path: 'user',
    model: 'User',
    select: driverClientSelect
}

export const driverOrderPopulate = [
    {
        path: 'cleaner',
        model: 'Cleaner',
        select: driverCleanerSelect
    },
    {
        path: 'client',
        model: 'User',
        select: driverClientSelect,
    },
    {
        path: 'pickUpDriver',
        model: 'Driver',
        select: orderDriversSelect,
        populate: orderDriversPopulate
    },
    {
        path: 'apartment',
        model: 'Apartment',
        select: {
            buildings: 0
        }
    },
    {
        path: 'origin',
        model: 'Address'
    },
    { 
        path: 'dropOffAddress',
        model: 'Address'
    }
]

export const driverCleanerPopulate = [
    {
        path: 'services',
        model: 'Service'
    },
    {
        path: 'address',
        model: 'Address'
    },
    {
        path: 'activeOrders',
        model: 'Order',
        select: driverOrderSelect,
        populate: driverOrderPopulate
    }
]

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
 * Populating the activeOrder field in the unit model. 
*/
const populateUnitOrder = {
    path: 'buildings.$*.units.$*.activeOrders',
    model: 'Order',
    populate: driverOrderPopulate,
    select: driverOrderSelect
}

const populateUnitClient = {
    path: 'buildings.$*.units.$*.client',
    model: 'User',
    select: {
        firstName: 1,
        lastName: 1,
        phoneNumber: 1
    }
}

export const driveAptPopulateToUnit = [
    {
        path: 'address',
        model: 'Address'
    },
    populateBldAddress,
    populateUnitAddress,
    populateUnitOrder,
    populateUnitClient
]

export const driverAptPopulate = [
    {
        path: 'address',
        model: 'Address'
    },
    populateBldAddress
]

export const driverAptSelect = {
    unitIndex: 0,
    paidFor: 0,
    createdBy: 0
}

export const clientsInUnit = async (unitId: string) => {
    return await User.find(
            {
                attachedUnitIds: {
                    $in: [unitId]
                }
            },
            driverClientSelect
        )
}
    