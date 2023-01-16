require('dotenv').config()
import mongoose from 'mongoose'
import express, { Application } from 'express'
import cors from 'cors'
import morgan from 'morgan'

const PORT = process.env.PORT || 5000
const app: Application = express()
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded())
app.use(cors())

if(process.env.ATLAS_URI) {
    mongoose.connect(process.env.ATLAS_URI,(err) => {
        if (err) {    
            console.log(err) 
            throw {
                statusCode: 500,
                message: "server error: database"
            }
        }   
        console.log("Connected successfully to database") 
    })
}

import Routes from './Routes'

app.use('/client', Routes.clientRouter)
app.use('/manager', Routes.managerRouter)
app.use('/driver', Routes.driverRouter)
app.use('/cleaner', Routes.cleanerRouter)
app.use('/cleanerPro', Routes.cleanerProRouter)
app.use('/admin', Routes.AdminRouter)

app.listen(PORT, () => console.log(`running on port: ${ PORT }`))
