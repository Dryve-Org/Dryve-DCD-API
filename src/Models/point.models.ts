import mongoose, { model } from 'mongoose'
import _ from 'lodash'
import { coordinatesT, validateGeo } from '../constants/location'

export interface PointI {
    type: 'Point'
    coordinates: coordinatesT
}

export const PointSchema = new mongoose.Schema<PointI>({
    type: {
        type: String,
        enum: ['Point'],
        required: true
    },
    coordinates: {
        type: [Number],
        required: true,
        validate(value: coordinatesT) {
            //validating longitude and latitude
            if(!validateGeo(value)) {
                throw new Error('invalid coordinates')
            }
        }
    }
})

const Point = model('Point', PointSchema)