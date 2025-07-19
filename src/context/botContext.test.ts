import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initial } from './botContext.js'
import { aiModels, aiPrompts } from '../config/index.js'

// Mock the config imports
vi.mock('../config/index.js', () => ({
    aiModels: [
        {
            model: 'test-model',
            name: 'Test Model',
            image: false,
            premium: false
        }
    ],
    aiPrompts: [
        {
            text: 'Test system prompt'
        }
    ]
}))

describe('botContext', () => {
    describe('initial', () => {
        it('should return initial session data with isPremium set to false', () => {
            const sessionData = initial()

            expect(sessionData).toEqual({
                model: aiModels[0],
                availableModels: aiModels,
                history: [],
                initialPrompt: {
                    role: 'system',
                    content: aiPrompts[0].text
                },
                isPremium: false
            })
        })

        it('should initialize isPremium as boolean false', () => {
            const sessionData = initial()

            expect(sessionData.isPremium).toBe(false)
            expect(typeof sessionData.isPremium).toBe('boolean')
        })

        it('should maintain all existing properties', () => {
            const sessionData = initial()

            expect(sessionData).toHaveProperty('model')
            expect(sessionData).toHaveProperty('availableModels')
            expect(sessionData).toHaveProperty('history')
            expect(sessionData).toHaveProperty('initialPrompt')
            expect(sessionData).toHaveProperty('isPremium')
        })

        it('should initialize history as empty array', () => {
            const sessionData = initial()

            expect(sessionData.history).toEqual([])
            expect(Array.isArray(sessionData.history)).toBe(true)
        })

        it('should set model to first available model', () => {
            const sessionData = initial()

            expect(sessionData.model).toEqual(aiModels[0])
        })

        it('should set availableModels to all models', () => {
            const sessionData = initial()

            expect(sessionData.availableModels).toEqual(aiModels)
        })

        it('should set initialPrompt with system role and first prompt text', () => {
            const sessionData = initial()

            expect(sessionData.initialPrompt).toEqual({
                role: 'system',
                content: aiPrompts[0].text
            })
        })
    })
})