export const ManagerPopulate = {
    path: 'userId',
    model: 'User',
    select: {
        password: 0,
        token: 0,
        cards: 0,
        orders: 0,
        preferences: 0
    }
}