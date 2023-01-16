import Cleaner from "../Models/cleaner.model"


/**
 * It returns a cleaner object if the cleaner id is valid, otherwise it throws an error
 * @param {string} clnId - string - the cleaner's id
 * @returns The cleaner object
*/
export const getCleanerById = async (clnId: string) => {
    const cleaner = await Cleaner.findById(clnId)
        .catch(() => {
            throw 'invalid order Id'
        })
    if(!cleaner) throw 'invalid order Id'

    return cleaner
}