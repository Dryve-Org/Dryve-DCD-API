
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
            activeOrders: 1
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
    },
    {
        path: 'desiredServices.service',
        model: 'Service',
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