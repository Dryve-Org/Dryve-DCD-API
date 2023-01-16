import { AddressI } from "../Models/address.model"

export interface CardI {
    cardNumber: string
    brand?: string
    exp_month: number
    exp_year: number
    last4: string
    cvc: string
    name: string
    billingAddress: AddressI
} 