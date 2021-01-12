import bcrypt from 'bcryptjs'
import { Maker } from '../models'

export const successResponse = (req, res, data, code = 200, meta) =>
  res.send({
    code,
    data,
    success: true,
    ...(meta !== undefined && { meta }),
  })

export const errorResponse = (
  req,
  res,
  errorMessage = 'Something went wrong',
  code = 500,
  errors = [],
) =>
  res.status(500).json({
    code,
    errorMessage,
    errors,
    data: null,
    success: false,
  })

export const validateFields = (object, fields) => {
  const errors = []
  fields.forEach((f) => {
    if (!(object && object[f])) {
      errors.push(f)
    }
  })
  return errors.length ? `${errors.join(', ')} are required fields.` : ''
}

export const verifyApiKey = async (req, res, next) => {
  const authHeader = req.headers['authorization']

  if (authHeader) {
    const [makerId, apiKey] = authHeader.split(':')
    if (makerId && apiKey) {
      const maker = await Maker.scope('withApiKey').findByPk(makerId)
      if (maker && bcrypt.compareSync(apiKey, maker.apiKey)) {
        req.maker = maker
      }
    }
  }

  next()
}

export const restrictToMaker = (req, res, next) => {
  if (req.maker) {
    next()
  } else {
    // Forbidden
    res.sendStatus(403)
  }
}

export const paginate = ({ page = 0, pageSize = 100 }) => {
  const offset = page * pageSize
  const limit = pageSize

  return {
    offset,
    limit,
  }
}
