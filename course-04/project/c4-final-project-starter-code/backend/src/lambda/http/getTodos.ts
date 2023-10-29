import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as middy from 'middy'
import { cors } from 'middy/middlewares'

import { getUserId } from '../utils';
import {getAllTodos} from "../../helpers/businessLogic/todos";
import {createLogger} from '../../utils/logger'

// TODO: Get all TODO items for a current user
const logger = createLogger('lambdaGetUser')

export const handler = middy(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    logger.info('event: ' + JSON.stringify(event));

    const userId = getUserId(event)
    logger.info('userId: ' + userId);

    const result = await getAllTodos(userId)
    return {
      statusCode: 200,
      body: JSON.stringify({
        items: result
      })
    }
  })
handler.use(
  cors({
    credentials: true
  })
)
