import bcrypt from 'bcryptjs'
import { Maker, Token } from '../models'

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
  res.status(code).json({
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
    const [publicToken, secretToken] = authHeader.split(':')
    if (publicToken && secretToken) {
      const token = await Token.findOne({ where: { publicToken }})
      if (token && bcrypt.compareSync(secretToken, token.secretToken)) {
        const maker = await Maker.findByPk(token.makerId)
        token.lastUsedAt = new Date()
        token.save()
        if (maker) {
          req.maker = maker
        }
      }
    }
  }

  next()
}

export const restrictToMaker = (req, res, next) => {
  if (req.maker) {
    next()
  } else {
    res.sendStatus(403) // Forbidden
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
