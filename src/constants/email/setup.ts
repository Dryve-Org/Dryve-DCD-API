require('dotenv').config()
import nodemailer from 'nodemailer'
import { numberToDollars } from '../moneyHandling'
import { unixToDate } from '../time'

export let transporter = nodemailer.createTransport({
    //@ts-ignore
    host: "smtp.office365.com",
    service: "Outlook365",
    secureConnection: false,
    tls: {
        ciphers: 'SSLv3'
    },
    secure: false,
    auth: {
        user: process.env.smtp_user,
        pass: process.env.smtp_pass,
    },
    port: 587
})

/**
 * This function sends an email to a user with a link to pay for their order.
 * @param {string} to - string,
 * @param {string} paymentLink - string,
 * @param {string} firstName - string,
 * @param {string} cleanerName - string,
 * @param {number} date - number,
 * @param {number} orderTotal - number,
*/
export const invoiceEmail = async (
    to: string,
    paymentLink: string,
    firstName: string,
    cleanerName: string,
    date: number,
    orderTotal: number,
) => {
    try {
        const options = {
            from: "TheDryve@outlook.com",
            to,
            subject: "Gourmade Laundry Invoice",
            text: `
                ${ unixToDate(date) }
                Hello ${ firstName },
        
                Your order at ${ cleanerName } of $${ numberToDollars(orderTotal) } is now ready for payment.
                Please click here to pay:
                ${ paymentLink }
        
                Thank you!
            `
        }
    
        await transporter.sendMail(options)
    } catch(e) {
        console.error('Unable to send user invoice and data:', e)
    }
}

/**
 * This function sends an email to the user with a link to verify their email.
 * @param {string} to - string,
 * @param {string} firstName - string,
 * @param {string} request - string -&gt; the url to send the user to verify their email
 * @param {string} [aptName] - string
*/
export const sendEmailVerify = async (
    to: string,
    firstName: string,
    request: string,
    aptName?: string
) => {
    try {
        const options = {
            from: "TheDryve@outlook.com",
            to,
            subject: `Verify Email ${ aptName && `for ${aptName}` }`,
            text: `
                Hello ${ firstName },
        
                In order to handle your dry cleaning we need to verify your email.
                Click here to verify.
                ${ request }
        
                Thank you!
            `
        }
    
        await transporter.sendMail(options)
    } catch(e) {
        console.error(`unable to verify email for ${ to }`, e)
    }
}