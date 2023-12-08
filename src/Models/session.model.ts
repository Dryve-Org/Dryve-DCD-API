import mongoose, { Types, model, Schema } from 'mongoose'
import validator from 'validator'

interface GeoSessionI {
    driver: Types.ObjectId
    attachedOrder: Types.ObjectId
    longitude: number
    lattitude: number
    created: number
    duration?: number //in seconds
}

const GeoSessionSchema = new Schema<GeoSessionI>({
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true
    },
    attachedOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    longitude: Number,
    lattitude: Number,
    duration: Number
})

const GeoSession = model('GeoSession', GeoSessionSchema)

export default GeoSession