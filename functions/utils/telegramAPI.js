/**
 * Telegram API 封装类
 */
export class TelegramAPI {
    constructor(botToken) {
        this.botToken = botToken;
        this.baseURL = `https://api.telegram.org/bot${this.botToken}`;
        this.defaultHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0"
        };
    }

    /**
     * 发送文件到Telegram
     * @param {File} file - 要发送的文件
     * @param {string} chatId - 聊天ID
     * @param {string} functionName - API方法名（如：sendPhoto, sendDocument等）
     * @param {string} functionType - 文件类型参数名（如：photo, document等）
     * @returns {Promise<Object>} API响应结果
     */
    async sendFile(file, chatId, functionName, functionType, caption = '', fileName = '') {
        const formData = new FormData();

        formData.append('chat_id', chatId);
        if (fileName) {
            formData.append(functionType, file, fileName);
        } else {
            formData.append(functionType, file);
        }
        if (caption) {
            formData.append('caption', caption);
        }

        const response = await fetch(`${this.baseURL}/${functionName}`, {
            method: 'POST',
            headers: this.defaultHeaders,
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Telegram API error: ${response.statusText}`);
        }

        // 解析响应数据
        const responseData = await response.json();

        return responseData;
    }

    /**
     * 获取文件信息
     * @param {Object} responseData - Telegram API响应数据
     * @returns {Object|null} 文件信息对象或null
     */
    getFileInfo(responseData) {
        const getFileDetails = (file) => ({
                file_id: file.file_id,
                file_name: file.file_name || file.file_unique_id,
                file_size: file.file_size,
            });

        try {
            if (!responseData.ok) {
                console.error('Telegram API error:', responseData.description);
                return null;
            }

            if (responseData.result.photo) {
                const largestPhoto = responseData.result.photo.reduce((prev, current) =>
                    (prev.file_size > current.file_size) ? prev : current
                );
                return getFileDetails(largestPhoto);
            }

            if (responseData.result.video) {
                return getFileDetails(responseData.result.video);
            }

            if (responseData.result.audio) {
                return getFileDetails(responseData.result.audio);
            }

            if (responseData.result.document) {
                return getFileDetails(responseData.result.document);
            }

            return null;
        } catch (error) {
            console.error('Error parsing Telegram response:', error.message);
            return null;
        }
    }

    /**
     * 获取文件路径
     * @param {string} fileId - 文件ID
     * @returns {Promise<string|null>} 文件路径或null
     */
    async getFilePath(fileId) {
        try {
            const url = `${this.baseURL}/getFile?file_id=${fileId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: this.defaultHeaders,
            });

            const responseData = await response.json();
            if (responseData.ok) {
                return responseData.result.file_path;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting file path:', error.message);
            return null;
        }
    }

    /**
     * 获取文件内容
     * @param {string} fileId - 文件ID
     * @returns {Promise<Response>} 文件响应
     */
    async getFileContent(fileId) {
        const filePath = await this.getFilePath(fileId);
        if (!filePath) {
            throw new Error(`File path not found for fileId: ${fileId}`);
        }

        const fullURL = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
        const response = await fetch(fullURL, {
            headers: this.defaultHeaders
        });

        return response;
    }

    /**
     * 设置 Webhook
     * @param {string} url - Webhook URL
     * @param {Object} options - 可选参数
     * @param {string} options.secret_token - 验证密钥
     * @param {Array<string>} options.allowed_updates - 允许的更新类型
     * @param {boolean} options.drop_pending_updates - 是否删除待处理的更新
     * @returns {Promise<Object>} API响应结果
     */
    async setWebhook(url, options = {}) {
        const params = new URLSearchParams({
            url: url
        });

        if (options.secret_token) {
            params.append('secret_token', options.secret_token);
        }

        if (options.allowed_updates && Array.isArray(options.allowed_updates)) {
            params.append('allowed_updates', JSON.stringify(options.allowed_updates));
        }

        if (options.drop_pending_updates !== undefined) {
            params.append('drop_pending_updates', options.drop_pending_updates.toString());
        }

        const response = await fetch(`${this.baseURL}/setWebhook?${params.toString()}`, {
            method: 'POST',
            headers: this.defaultHeaders
        });

        const responseData = await response.json();
        return responseData;
    }

    /**
     * 获取 Webhook 信息
     * @returns {Promise<Object>} Webhook信息
     */
    async getWebhookInfo() {
        const response = await fetch(`${this.baseURL}/getWebhookInfo`, {
            method: 'GET',
            headers: this.defaultHeaders
        });

        const responseData = await response.json();
        return responseData;
    }

    /**
     * 删除 Webhook
     * @param {boolean} dropPendingUpdates - 是否删除待处理的更新
     * @returns {Promise<Object>} API响应结果
     */
    async deleteWebhook(dropPendingUpdates = false) {
        const params = new URLSearchParams({
            drop_pending_updates: dropPendingUpdates.toString()
        });

        const response = await fetch(`${this.baseURL}/deleteWebhook?${params.toString()}`, {
            method: 'POST',
            headers: this.defaultHeaders
        });

        const responseData = await response.json();
        return responseData;
    }

}