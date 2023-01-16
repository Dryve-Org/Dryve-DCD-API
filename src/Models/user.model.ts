import mongoose, { Types, model, Schema } from "mongoose"
import validator from 'validator'
import bcrypt from 'bcrypt'
import { isOfAge, isUnixDate } from "../constants/time"
import jwt from 'jsonwebtoken'
import { MongooseFindByReference } from "mongoose-find-by-reference"
import { AddressI } from "./address.model"

export interface UserI {
    _id?: any
    firstName: string
    lastName: string
    email: string
    password: string
    phoneNumber: string
    dob: number
    address: Types.ObjectId
    pickUpAddresses: Types.ObjectId[]
    stripeId: string
    token?: string
    cards: string[]
    created: number
    refreshToken?: string
    orders: Types.ObjectId[]
    generateAuthToken: () => string
    preferredCleaner?: Types.ObjectId 
    pickupAddress?: Types.ObjectId
    preferredCardId: string
    emailVerified: boolean
}

const UserSchema = new Schema<UserI>({
    firstName: {
        type: String,
        require: true,
        lowercase: true,
    },
    lastName: {
        type: String,
        require: true,
        lowercase: true,
    },
    email: {
        type: String,
        unique: true,
        lowercase: true,
        validate(value: string){
            if(!validator.isEmail(value)){
                throw new Error('Email is invalid')
            }
        }
    },
    password: {
        type: String,
        minlength: 3,
        trim: true,
        required: true,
        validate(value: string) {
            if(value.toLowerCase().includes('password')){
                throw new Error('password cannot contain "password"')
            }
        }
    },
    phoneNumber: {
        type: String,
        required: true,
        validate(value: string) {
            if(!validator.isMobilePhone(value)) {
                throw new Error("phone number not valid")
            }
        }
    },
    dob: {
        type: Number,
        required: true,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            } else if(!isOfAge) {
                throw new Error("User has to be 18 or older")
            }
        }
    },
    stripeId: {
        type: String,
    },
    address: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    },
    created: {
        type: Number,
        required: true
    },
    pickUpAddresses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    }],
    cards: [{
        type: String,
    }],
    orders: [{
        type: Schema.Types.ObjectId,
        ref: 'Order',
        default: []
    }],
    preferredCleaner: {
        type: Schema.Types.ObjectId,
        ref: 'Cleaner'
    },
    pickupAddress: {
        type: Schema.Types.ObjectId,
        ref: 'Address'
    },
    preferredCardId: String,
    token: String,
    refreshToken: String,
    emailVerified: Boolean
})

UserSchema.plugin(MongooseFindByReference)

UserSchema.methods.generateAuthToken = async function() {
    const user = this
    if(!process.env.JWT || !process.env.REFRESHJWT) throw "server error: token"
    const token = jwt.sign(
        {
            _id: user._id.toString()
        }, 
        process.env.JWT,
        { expiresIn: "5d" }
    )

    user.token = token
    user.save()
    return token
}


//edit: this is not done at all
// UserSchema.methods.refreshToken = async function(rToken: string) {
//     const user = this
//     if(!process.env.JWT) throw "server error: token"
//     const token = jwt.sign(
//         {
//             _id: user._id.toString()
//         }, 
//         process.env.JWT,
//         { expiresIn: "7d" }
//     )
//     user.token = token
//     user.save()
//     return token
// }

UserSchema.pre('save', async function (next) { //must use ES5 function to use the "this" binding
    const user = this // "this" is in reverence to userSchema

    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8)
    }

    next() // without next the function will hang and never save
})

const User = model("User", UserSchema)

export default User