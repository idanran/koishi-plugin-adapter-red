import { Context, sanitize, trimSlash, Quester, Dict } from 'koishi'
import { RedBot } from './bot'
import { Message } from './types'
import { } from '@koishijs/plugin-server'

export class RedAssets<C extends Context = Context> {
    private path: string
    constructor(private bot: RedBot<C>, private config: RedBot.Config) {
        const num = Number(this.bot.selfId) || 0
        const unique = num.toString(32)
        this.path = sanitize(`${this.config.path || '/files'}/${unique}`)
        this.bot.logger.info(`current assets are located at ${this.path}`)
        this.listen()
    }
    set(message: Message, elementId: string, mime: string, md5: string) {
        const payload = Buffer.from(JSON.stringify({
            msgId: message.msgId,
            chatType: message.chatType,
            peerUid: message.peerUin,
            elementId,
            mime,
            md5
        })).toString('base64url')
        return `${this.selfUrl}${this.path}/${payload}`
    }
    get(payload: Dict) {
        return this.bot.internal.getFile({
            msgId: payload.msgId,
            chatType: payload.chatType,
            peerUid: payload.peerUid,
            elementId: payload.elementId,
        })
    }
    private get selfUrl() {
        if (this.config.selfUrl) {
            return trimSlash(this.config.selfUrl)
        }
        return this.bot.ctx.server.selfUrl || `http://127.0.0.1:${this.bot.ctx.server.port}`
    }
    private listen() {
        this.bot.ctx.server.get(this.path, async (ctx) => {
            ctx.body = '200 OK'
            ctx.status = 200
        })
        this.bot.ctx.server.get(this.path + '/:data', async (ctx) => {
            const data = ctx.params['data']
            let payload: Dict
            if (data.endsWith('=')) {
                payload = JSON.parse(Buffer.from(data, 'base64').toString())
            } else {
                payload = JSON.parse(Buffer.from(data, 'base64url').toString())
            }
            const mime = payload.mime
            let response: Quester.AxiosResponse
            try {
                response = await this.get(payload)
            } catch (e) {
                if (mime.includes('image')) {
                    response = await this.bot.ctx.http.axios(`https://gchat.qpic.cn/gchatpic_new/0/0-0-${payload.md5.toUpperCase()}/0`, {
                        method: 'GET',
                        responseType: 'arraybuffer'
                    })
                }
                response ||= e.response
            }
            ctx.body = response.data
            ctx.type = response.headers['content-type']
            if (!ctx.type && response.status === 200) {
                ctx.type = mime
            }
            ctx.header['date'] = response.headers['date']
            ctx.status = response.status
        })
    }
}