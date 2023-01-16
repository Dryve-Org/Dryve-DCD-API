import { config } from "dotenv";
import { Types } from "mongoose";
import Stripe from "stripe"
import validator from "validator";
import { CurrencyCodes } from "validator/lib/isISO4217";
import { CardI } from "../interfaces/moneyHandling";
import { AddressI } from "../Models/address.model";
import User, { UserI } from "../Models/user.model";

const stripekey = process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY : ""
export const stripe = new Stripe(stripekey, {
    apiVersion: '2020-08-27'
})

export const numberToDollars = (num: number) => num / 100

/**
 * This function creates a stripe customer with the given email address and returns the customer
 * object.
 * @param {string} email - string
 * @returns The customer object
*/
export const createStripeCustomer = async (email: string) => {
    if(!validator.isEmail(email)) {
        throw {
            statusCode: 400,
            message: "Could not create stripe customer"
        }
    }

    const customer = await stripe.customers.create({ email })

    return customer
}

//edit: validate cardInfo
export const createCard = async (
    userInfo: UserI, 
    cardInfo: CardI,
    addy?: AddressI
): Promise<Stripe.PaymentMethod> => {                                

    // @ts-ignore
    const billingAddressProp = (prop: string) => addy ? addy[prop] : cardInfo.billingAddress[prop]
    const card = await stripe.paymentMethods.create({
        type: 'card',
        card: {
            number: cardInfo.cardNumber,
            exp_month: cardInfo.exp_month,
            exp_year: cardInfo.exp_year,
            cvc: cardInfo.cvc
        },
        billing_details: {
            address: {
                city: billingAddressProp("city"),
                state: billingAddressProp("state"),
                postal_code: billingAddressProp("zipcode"),
                line1: billingAddressProp("street_address_line_1"),
                line2: billingAddressProp("street_address_line_2"),
                country: billingAddressProp("country") === "United States" ? "US" : billingAddressProp("country")
            },
            email: userInfo.email,
            phone: userInfo.phoneNumber,
            name: cardInfo.name
        }
    }).catch(() => {
        throw 'unable to store card'
    })

    await stripe.paymentMethods.attach(
        card.id,
        { customer: userInfo.stripeId }
    ).catch(() => {
        throw 'unable to attach card to new user'
    })

    return card
}

/**
 * It returns a card if it exists, otherwise it returns undefined
 * @param {string} cardId - The ID of the card to retrieve.
 * @returns A promise that resolves to a Stripe.PaymentMethod or undefined.
*/
export const reteiveCard = async (cardId: string): Promise<Stripe.PaymentMethod | undefined> => {
    try {
        const card = await stripe.paymentMethods.retrieve(cardId)
        return card
    } catch {
        return undefined
    }
}

/**
 * "This function takes an array of card IDs and returns an array of card data."
 *
 * @param {string[]} cards - string[] - An array of card IDs
 * @returns An array of Stripe.PaymentMethod objects.
*/
export const reteiveCards = async (cards: string[]): Promise<Stripe.PaymentMethod[]> => {
    const cardData: Stripe.PaymentMethod[] = []

    for (const cardId of cards) {
        const card = await reteiveCard(cardId)
        /*
            edit: might wanna throw error here
            but I don't feel like it right now
        */
        if(card) {
            cardData.push(card)
        }
    }

    return cardData
}

type chargingFor = "to Cleaner" |
                   "from Cleaner" |
                   "cleaner service" |
                   "Order Fee"

interface paymentMetaData {
    chargingFor: chargingFor
    feeIncluded?: boolean
}

/**
 * It takes in a user's info, a card id, an amount, and some metadata, and then creates a payment
 * intent with the given information.
 * @param {UserI} userInfo - UserI = {
 * @param {string} cardId - string
 * @param {number} amount - number, //in pennies
 * @param {paymentMetaData} metadata - {
 * @param {boolean} [confirm] - boolean - whether or not to confirm the payment intent. If you don't
 * confirm it, you can't charge the card.
 * @returns {
 *   "id": "pi_1GQQQ2EZvf5UNvlQQQQQQQQQ",
 *   "object": "payment_intent",
 *   "amount": 100,
 *   "amount_capturable": 0,
 *   "amount_received": 0,
 *   "application": null,
 *   "
*/
export const createClientCharge = async (
    userInfo: UserI, 
    cardId: string,
    amount: number,
    metadata: paymentMetaData,
    confirm?: boolean
) => {

    console.log("cardId: ", cardId)
    const paymentIntents = await stripe.paymentIntents.create({
        amount: amount, //in pennies
        currency: 'usd',
        payment_method_types: ['card'],
        payment_method: cardId,
        customer: userInfo.stripeId,
        setup_future_usage: 'on_session',
        metadata: {
            'chargingFor': metadata.chargingFor,
            feeIncluded: metadata.feeIncluded ? 1 : 0 //can't store boolean so using numbers instead
        }
    }).catch(e => {
        throw {
            statusCode: e.statusCode,
            message: e.message
        }
    })

    return paymentIntents
}

/**
 * It removes a card from a user's account, and then removes the card from Stripe
 * @param userId - the user's id
 * @param {string} cardId - the id of the card to be removed
 * @returns The user object and the removedRes object.
*/
export const removeCard = async (userId: Types.ObjectId, cardId: string) => {
    try {
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $pullAll: { cards: [ cardId ] }
            }
        ).catch(() => {
            throw {
                statusCode: 501,
                message: "server error: could not remove card from user"
            }
        })

        if(!user) throw {
            statusCode: 500,
            user: "server error: card may or may not be removed?"
        }

        const removedRes = await stripe.paymentMethods.detach(cardId)
            .catch(e => {
                throw {
                    statusCode: 501,
                    message: e.message
                }
            })
        
        return {
            user,
            removedRes
        }

    } catch(e) {
        throw e
    }
}

/**
 * This function creates a payment intent with the amount of 2000 and the currency of USD.
 * @param {number} amount - The amount to charge the customer, in the smallest currency unit. For
 * example, if you want to charge 10.50, this value would be 1050.
 */
export const createPaymentIntent = async (
    amount: number
) => {
    const pI = await stripe.paymentIntents.create(
        {
            amount: amount,
            currency: 'usd'    
        }
    )
    .catch(() => {
        throw 'unable to create payment intent'
    })

    return pI
}

/**
 * This function updates the amount of a payment intent.
 * @param {string} pIId - the payment intent id
 * @param {number} amount - The amount to charge the customer.
 * @returns The updated payment intent.
 */
export const updateAmount = async (
    pIId: string,
    amount: number
) => {
    const pI = await stripe.paymentIntents.update(pIId, {
        amount
    })
    .catch(() => {
        throw 'unable to update payment intent'
    })

    return pI
}