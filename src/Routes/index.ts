import cleanerRouter from "./cleaner"
import clientRouter from "./client/index"
import driverRouter from "./driver/index"
import managerRouter from "./manager/index"
// import orderRouter from "./order"
import cleanerProRouter from './cleanerPro'
import AdminRouter from "./admin"

export default {
    clientRouter,
    driverRouter,
    cleanerRouter,
    managerRouter,
    cleanerProRouter,
    AdminRouter
}

