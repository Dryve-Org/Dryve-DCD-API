import mongoose, { Schema, model, Types, Model, Document } from 'mongoose'
import { MongooseFindByReference } from 'mongoose-find-by-reference'
import validator from 'validator'
import { isUnixDate, now } from '../constants/time'
import Manager, { ManagerI } from './manager.models'
import bcrypt from 'bcrypt'
import Apt from './apartment.model'
import jwt from 'jsonwebtoken'

export interface AptManI {
    _id: Types.ObjectId
    email: string
    password: string
    firstName: string
    lastName: string
    nickname: string
    phoneNumber: string
    attachedApts: Types.ObjectId[]
    created: number
    createdBy: ManagerI['_id']
    token?: string
}

export type AptManDocT = mongoose.Document<unknown, any, AptManI> & AptManI & {
    _id: Types.ObjectId
}

export type AptModelT = Model<AptManI, {}, AptManI>

export interface AptManMethodsI {
    getFullName(): string
    generateAuthToken(): string
    /**
     * Validates password
     * 
     * @param password password to compare
     * @returns true if password matches, false otherwise
     */
    comparePassword(password: string): Promise<boolean>
}

const AptManSchema = new Schema<AptManI, AptModelT, AptManMethodsI>({
    firstName: {
        type: String,
        require: true,
        lowercase: true,
    },
    lastName: {
        type: String,
        require: true,
    },
    nickname: {
        type: String,
        lowercase: true,
        default: ''
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
        validate(value: string) {
            if(!validator.isMobilePhone(value)) {
                throw new Error("phone number not valid")
            }
        }
    },
    attachedApts: [{
        type: Schema.Types.ObjectId,
        ref: 'Apartment',
        default: []
    }],
    created: {
        type: Number,
        required: true,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Manager',
        required: true
    }
})

AptManSchema.plugin(MongooseFindByReference)

AptManSchema.pre('save', async function(next) {
    const aptMan = this

    //check if attachedApts is an array of ObjectIds of valid apts
    if(aptMan.isModified('attachedApts')) {
        const apts = await Apt.find({
            _id: {
                $in: aptMan.attachedApts
            }
        })
        if(apts.length !== aptMan.attachedApts.length) {
            throw new Error('Invalid apt id')
        }
    }

    if(!aptMan.created) {
        aptMan.created = now()
    }

    //check if createdBy is a valid manager
    if(aptMan.isModified('createdBy')) {
        const manager = await Manager.findById(aptMan.createdBy)
        if(!manager) {
            throw new Error('Invalid manager id')
        }
    }

    if(!aptMan.password) {
        aptMan.password = '123'
    }

    if(aptMan.isModified('password')) {
        aptMan.password = await bcrypt.hash(aptMan.password, 8)
    }

    next()
})

AptManSchema.method<AptManDocT>('generateAuthToken', async function() {
    const aptMan = this

    if(!process.env.JWT || !process.env.REFRESHJWT) throw new Error("server error: token")

    const token = jwt.sign(
        { 
            _id: aptMan._id.toString() 
        }, 
        process.env.JWT,
        { expiresIn: '5d' }
    )
    
    aptMan.token = token
    aptMan.save()
    return token
})


AptManSchema.methods.getFullName = function() {
    return `${this.firstName} ${this.lastName}`
}

AptManSchema.method<AptManDocT>('comparePassword', async function(password: string) {
    const aptMan = this
    return await bcrypt.compare(password, aptMan.password)
})

const AptMan = model<AptManI, AptModelT>('AptMan', AptManSchema)

export default AptMan

