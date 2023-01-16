import Apt, { AptDocT } from "../Models/apartment.model"

/**
 * Get Apartment By Id and will throw if cant receive it
 * @param {string} orderId - string
 * @returns {AptDocT} The Apartment object
*/
export const getAptById = async (aptId: string) => {
    const apt = await Apt.findById(aptId)
        .catch(() => {
            throw 'invalid order Id'
        })
    if(!apt) throw 'invalid order Id'

    return apt
}