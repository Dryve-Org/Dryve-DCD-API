import mongoose, { Schema, model } from "mongoose"
import { coordinatesT, geoHandleAddress } from '../constants/location'
import { PointI, PointSchema } from "./point.models"

export interface AddressI {
    name?: string
    street_address_line_1: string
    street_address_line_2?: string
    city: string
    state: string
    zipcode: string
    country: string
    formatted?: string
    placeId?: string
    location?: PointI
}

export type AddressDocT = mongoose.Document<unknown, any, AddressI> & AddressI & {
    _id: mongoose.Types.ObjectId;
}

const AddressSchema = new Schema<AddressI>({
    name: String,
    street_address_line_1: {
        type: String,
        required: true
    },
    street_address_line_2: String,
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    zipcode: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    placeId: {
        type: String,
        unique: true
    },
    formatted: String,
    location: {
        type: PointSchema,
        index: '2dsphere' // Create a special 2dsphere index on `address.location`
    }
})

AddressSchema.index({ location: '2dsphere' })

AddressSchema.pre('save', async function (next) { //must use ES5 function to use the "this" binding
    const address: AddressDocT = this // "this" is in reverence to userSchema
    try { 
        if (address.isModified() || !address.__v) {
            const geoData = await geoHandleAddress(address)

            address.placeId = geoData.results[0].place_id
            address.formatted = geoData.results[0].formatted_address
            const lat = geoData.results[0].geometry.location.lat
            const lng = geoData.results[0].geometry.location.lng
            address.location = {
                type: 'Point',
                coordinates: [
                    lng,
                    lat
                ]
            }
        }
    } catch {
        throw 'was not able to create address'
    }

    next() // without next the function will hang and never save
})

const Address = model('Address', AddressSchema)

export default Address