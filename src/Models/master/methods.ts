import { Types } from 'mongoose'
import { ClientPreferenceI, MasterDocT, MasterI } from '.'
import { err } from '../../constants/general'

/**
 * increment apartment id index
 * 
 * @return {Promise<MasterI>} - updated master document
 */
export async function incrementApartmentIdIndex (this: MasterDocT) {
    try {
        const master = this
    
        master.apartment_id_index += 1
    
        await master.save()
    } catch {
        throw err(500, 'could not increment apartment id index')
    }
}

export const addClientPreference = async function(
    this: MasterDocT,
    title: string,
    description: string,
    type: ClientPreferenceI['type']
) {
    try {
        const master = this
        
        await master.update({
            $push: {
                clientPreferences: {
                    title,
                    description,
                    type
                }
            }
        })
    
        return master
    } catch(e) {
        console.log(e)
        throw err(400, 'could not add client preference')
    }
}

export const removeClientPreference = async function(
    this: MasterDocT,
    id: string | Types.ObjectId
) {
    try {
        const master = this
    
        await master.update({
            $pull: {
                clientPreferences: {
                    _id: id
                }
            }
        })
    
        return master
    } catch(e) {
        throw err(400, 'could not remove client preference')
    }
}