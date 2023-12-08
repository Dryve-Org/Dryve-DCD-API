import _ from 'lodash'
import mongoose, { Schema, model, Types } from 'mongoose'

export interface AptBuildingI {
    Apt: Types.ObjectId
    address: Types.ObjectId
    units: {
        
    }
}