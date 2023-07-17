
export const CleanerProOrderSelect = {
    userCard: 0,
    dropOffAddress: 0,
    origin: 0,
}

export const CleanerProDriverSelect = {
    user: 1
}

export const CleanerProClientSelect = {
    firstName: 1,
    lastName: 1,
    phoneNumber: 1,
    email: 1
}

export const CleanerProCleanerSelect = {
    cardId: 0,
    stripe: 0
}

export const CleanerProDriverPopulate = [
    {
        path: 'user',
        model: 'User',
        select: {
            ...CleanerProClientSelect
        }
    }
]

export const CleanerProDesiredSvcsSelect = {}   

export const CleanerProOrderPopulate = [
    {
        path: 'cleaner',
        model: 'Cleaner',
        select: {
            name: 1,
            email: 1,
            website: 1,
            address: 1,
            activeOrders: 1,
            machines: 1,
        }
    },
    {
        path: 'cleanerAddress',
        model: 'Address',
    },
    {
        path: 'pickUpDriver',
        model: 'Driver',
        select: CleanerProDriverSelect,
        populate: CleanerProDriverPopulate
    },
    {
        path: 'dropOffDriver',
        model: 'Driver',
        select: CleanerProDriverSelect,
        populate: CleanerProDriverPopulate
    },
    {
        path: 'client',
        model: 'User',
        select: CleanerProClientSelect
    }
]

export const CleanerProCleanerPopulate = [
    {
        path: 'activeOrders',
        model: 'Order',
        select: CleanerProOrderSelect,
        populate: CleanerProOrderPopulate
    },
    {
        path: 'address',
        model: 'Address'
    },
    {
        path: 'services',
        model: 'Service'
    }
]

/** 
 * Populating the activeOrder field in the unit model. 
*/
const populateUnitOrder = {
    path: 'buildings.$*.units.$*.activeOrders',
    model: 'Order',
    select: CleanerProOrderSelect,
    populate: CleanerProOrderPopulate
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
        preferences: 1,
    }
}

export const CleanerProAptSelect = {
    address: 1,
    aptId: 1,
    name: 1,
    email: 1,
    buildings: 1,
}

export const CleanerProAptPopulate = [
    {
        path: 'address',
        model: 'Address'
    },
    {
        path: 'buildings',
        populate: [
            {
                path: 'address',
                model: 'Address'
            },
        ]
    },
    {
        path: 'buildings.$*.units.$*.client',
        model: 'User',
        select: {
            firstName: 1,
            lastName: 1,
            phoneNumber: 1
        }
    }
]

export const CleanerproAptPopulateToUnit = [
    {
        path: 'address',
        model: 'Address'
    },
    {
       ...populateUnitClient,
    },
    {
        ...populateUnitOrder,
    }
    // {
    //     path: 'buildings',
    //     populate: [
    //         {
    //             path: 'address',
    //             model: 'Address'
    //         },
    //         {
    //             path: 'units',
    //             select: {
    //                 unitId: 1,
    //                 client: 1,
    //                 address: 1,
    //                 activeOrder: 1,
    //             },
    //             populate: [
    //                 {
    //                     path: 'client',
    //                     model: 'User',
    //                     select: CleanerProClientSelect
    //                 },
    //                 {
    //                     path: 'activeOrder',
    //                     model: 'Order',
    //                     select: CleanerProOrderSelect,
    //                     populate: CleanerProOrderPopulate
    //                 }
    //             ]
    //         }
    //     ]
    // }
]