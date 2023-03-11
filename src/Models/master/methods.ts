import { MasterDocT } from '.'
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