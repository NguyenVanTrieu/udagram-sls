import * as AWS from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { FILTER, createLogger } from '../../utils/logger'
import { TodoItem } from '../../models/TodoItem'
import { TodoUpdate } from '../../models/TodoUpdate'
import { UpdateTodoRequest } from '../../requests/UpdateTodoRequest'
import * as uuid from 'uuid'
const AWSXRay = require('aws-xray-sdk')

import {
  deleteAttachmentImage,
  generateAttachmentURL,
  getPreSignedUploadUrl
} from '../businessLogic/attachmentUtils'

const XAWS = AWSXRay.captureAWS(AWS)

const logger = createLogger('TodosAccess')

// TODO: Implement the dataLayer logic

export class TodosAccess {
  constructor(
    private readonly docClient: DocumentClient = new XAWS.DynamoDB.DocumentClient(),
    private readonly todoTable = process.env.TODOS_TABLE
  ) {}

  async createTodo(todoItem: TodoItem): Promise<TodoItem> {
    await this.docClient
      .put({
        TableName: this.todoTable,
        Item: todoItem
      })
      .promise()

    return todoItem
  }

  async updateTodo(
    userId: String,
    todoId: String,
    updateTodoRequest: UpdateTodoRequest
  ): Promise<TodoUpdate> {
    logger.info(`Updating todo record by userId :${userId}, todoId :${todoId}`)
    await this.docClient
      .update({
        TableName: this.todoTable,
        Key: { userId: userId, todoId: todoId },
        UpdateExpression:
          'set #todo_name = :name, dueDate = :dueDate, done = :done',
        ExpressionAttributeValues: {
          ':name': updateTodoRequest.name,
          ':dueDate': updateTodoRequest.dueDate,
          ':done': updateTodoRequest.done
        },
        ExpressionAttributeNames: { '#todo_name': 'name' }
      })
      .promise()

    const todoUpdate: TodoUpdate = {
      ...updateTodoRequest
    }

    return todoUpdate
  }

  async attachmentImage(userId: String, todoId: String): Promise<String> {
    logger.info(
      `Attachment image to Todo with userId :${userId}, todoId :${todoId}`
    )
    const imageId = uuid.v4()
    const attachmentUrl = generateAttachmentURL(imageId)
    await this.docClient
      .update({
        TableName: this.todoTable,
        Key: { userId: userId, todoId: todoId },
        UpdateExpression: 'set attachmentUrl = :attachmentUrl',
        ExpressionAttributeValues: { ':attachmentUrl': attachmentUrl }
      })
      .promise()
    const uploadUrl = getPreSignedUploadUrl(imageId)
    return uploadUrl
  }

  async deleteTodo(userId: String, todoId: String) {
    logger.info(`Deleting Todo userId :${userId}, todoId :${todoId}`)
    var params = {
      TableName: this.todoTable,
      Key: {
        userId: userId,
        todoId: todoId
      }
    }

    await this.docClient.delete(params, function (err, data) {
      if (err) {
        logger.error(`Deleting error :${JSON.stringify(data)}`)
      } else {
        logger.info(`Deleting Success todoId: ${todoId}`)
        logger.info(`Deleting Success data: ${JSON.stringify(data)}`)
      }
    })
    logger.info(`Deleting Success`)
  }

  async getAllTodos(
    userId: String,
    filter: String,
  ): Promise<TodoItem[]> {
    logger.info(`Start findByUserId:${userId}`)

    const params: any = {
      TableName: this.todoTable,
      KeyConditionExpression: '#todo_userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ExpressionAttributeNames: { '#todo_userId': 'userId' }
    }

    if (filter === FILTER.DONE) {
      params.ExpressionAttributeValues = { ':userId': userId, ':done': true }
      params.FilterExpression = 'done = :done'
    }
    if (filter === FILTER.TODO) {
      params.ExpressionAttributeValues = { ':userId': userId, ':done': false }
      params.FilterExpression = 'done = :done'
    }


    logger.info('End findByUserId params' + JSON.stringify(params))
    const result = await this.docClient.query(params).promise()
    const items = result.Items
    return items as TodoItem[]
  }

  async removeAttachment(userId: String, todoId: String, imageId: string) {
    logger.info(`Remove attachment todoId:${todoId}, imageId:${imageId}`)
    await this.docClient
      .update({
        TableName: this.todoTable,
        Key: { userId: userId, todoId: todoId },
        UpdateExpression: 'set #attachmentUrl = :attachmentUrl',
        ExpressionAttributeValues: { ':attachmentUrl': '' },
        ExpressionAttributeNames: { '#attachmentUrl': 'attachmentUrl' }
      })
      .promise()

    await deleteAttachmentImage(imageId)
    logger.info(`Remove attachment todoId:${todoId} success`)
  }
}
