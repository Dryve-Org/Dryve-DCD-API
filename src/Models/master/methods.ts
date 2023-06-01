import { Types } from 'mongoose'
import { ClientPreferenceI, MasterDocT, MasterI } from '.'
import { err } from '../../constants/general'
import SAP, { SAPI } from '../ServicesAndProducts'

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

export const listServices = async function(this: MasterDocT) {
    const master = this

    const saps = await SAP.find({
        _id: {'$in': master.servicesAndProducts}
    }, {
        list: 1
    })

    if(!saps) throw 'unable to get SAPs'

    const services: SAPI['list'] = []

    saps.forEach(sap => {
        sap.list.forEach(prod => {
            if(prod.sapType === 'service') {
                services.push(prod)
            }
        })
    })

    return services
}