import { Sidekick } from "../sidekick.js";
import { SETTING_KEYS, DEFAULT_CONFIG, NAME, PATH } from "../butler.js";
import { EnhancedConditions } from "../enhanced-conditions/enhanced-conditions.js";
import { TrigglerForm } from "./triggler-form.js";

/**
 * Handles triggers for other gadgets in the module... or does it?!
 */
export class Triggler {
    /**
     * Creates a button for the Condition Lab
     * @param {Object} html the html element where the button will be created
     */
    static _createTrigglerButton(html) {
        if (!game.user.isGM) {
            return;
        }

        const cubDiv = html.find("#combat-utility-belt");

        const trigglerButton = $(
            `<button id="triggler-form" data-action="triggler">
                    <i class="fas fa-angle-double-right"></i><i class="fas fa-angle-double-left"></i> ${DEFAULT_CONFIG.triggler.form.title}
                </button>`
        );
        
        cubDiv.append(trigglerButton);

        trigglerButton.click(ev => {
            new TrigglerForm().render(true);
        });
    }

    /**
     * Executes a trigger calling predefined actions
     * @param {*} trigger 
     * @param {*} target 
     */
    static _executeTrigger(trigger, target) {
        const tokens = target instanceof Token ? [target] : target instanceof Actor ? target.getActiveTokens() : null;

        if (!tokens) {
            return;
        }

        const conditionMap = Sidekick.getSetting(SETTING_KEYS.enhancedConditions.map);
        
        const matchedApplyConditions = conditionMap.filter(m => m.applyTrigger === trigger.id);

        const matchedRemoveConditions = conditionMap.filter(m => m.removeTrigger === trigger.id);

        const matchedMacros = game.macros.entities.filter(m => m.getFlag(NAME, DEFAULT_CONFIG.triggler.flags.macro) === trigger.id);

        matchedApplyConditions.forEach(m => EnhancedConditions.applyCondition(m.name, tokens, {warn: false}));
        matchedRemoveConditions.forEach(m => EnhancedConditions.removeCondition(m.name, tokens, {warn: false}));
        matchedMacros.forEach(m => m.execute());
    }

    /**
     * Processes an entity update and evaluates triggers
     * @param {*} entity 
     * @param {*} update 
     * @param {*} entryPoint1
     * @param {*} entrypoint2
     */
    static _processUpdate(entity, update, entryPoint1, entrypoint2) {
        if (entryPoint1 && !hasProperty(update, entryPoint1)) {
            return;
        }
        
        const triggers = Sidekick.getSetting(SETTING_KEYS.triggler.triggers);
        const entityType = entity instanceof Actor ? "Actor" : entity instanceof Token ? "Token" : null;

        if (!entityType) {
            return;
        }

        const isPC = !!(entityType === "Actor" ? entity.isPC : entityType === "Token" ? entity.actor.isPC : null);

        /**
         * process each trigger in turn, checking for a match in the update payload,
         * if a match is found, then test the values using the appropriate operator,
         * if values match, apply any mapped conditions
         * @todo reduce this down to just mapped triggers at least
         */
        for (let trigger of triggers) {
            const pcOnly = trigger.pcOnly;
            const npcOnly = trigger.npcOnly;
            const notZero = trigger.notZero;

            if (pcOnly && !isPC) {
                continue;
            }

            if (npcOnly && isPC) {
                continue;
            }

            // example : actorData.data.attributes.hp.value
            const matchString1 = `${entryPoint1}.${trigger.category}.${trigger.attribute}.${trigger.property1}`;

            // example: actor.data.data.hp.max -- note this is unlikely to be in the update data
            const matchString2 = `${entrypoint2}.${trigger.category}.${trigger.attribute}.${trigger.property2}`;

            // If the update doesn't have a value that matches the 1st property this trigger should be skipped
            if (!hasProperty(update, matchString1)) {
                continue;
            }
            
            // Get a value from the update that matches the 1st property in the trigger
            const updateValue = getProperty(update, matchString1);

            // If the trigger is not allowed to run when value is zero, skip
            if (updateValue === 0 && notZero) {
                continue;
            }

            // Get a value from the entity that matches the 2nd property in the trigger (if any)
            const property2Value = getProperty(entity, matchString2);

            // We need the type later
            const updateValueType = typeof updateValue;

            // example: "="
            const operator = DEFAULT_CONFIG.triggler.operators[trigger.operator];
            
            // percent requires whole different handling
            const isPercent = trigger.value.endsWith("%");

            // example: "50" -- check if the value can be converted to a number
            const triggerValue = isPercent ? trigger.value.replace("%","") * 1 : Sidekick.coerceType(trigger.value, updateValueType);
            
            /**
             * Switch on the operator checking it against the predefined operator choices
             * If it matches, then compare the values using the operator
             */
            switch (operator) {
                case DEFAULT_CONFIG.triggler.operators.eq:
                    if (isPercent) {
                        // example: (50 / 100) = 0.5;
                        const divisor = (triggerValue / 100);
                        // if property 1 update value = 50% of property 2 value
                        if (updateValue === (property2Value * divisor)) {
                            Triggler._executeTrigger(trigger, entity);
                            break;
                        }
                    }
                    if (updateValue === triggerValue) {
                        // execute the trigger's condition mappings
                        Triggler._executeTrigger(trigger, entity);
                        break;
                    }
                    break;

                case DEFAULT_CONFIG.triggler.operators.gt:
                    if (isPercent) {
                        // example: (50 / 100) = 0.5;
                        const divisor = (triggerValue / 100);
                        // if property 1 update value = 50% of property 2 value
                        if (updateValue > (property2Value * divisor)) {
                            Triggler._executeTrigger(trigger, entity);
                            break;
                        }
                    }
                    if (updateValue > triggerValue) {
                        Triggler._executeTrigger(trigger, entity);
                    }
                    break;

                case DEFAULT_CONFIG.triggler.operators.gteq:
                    if (isPercent) {
                        // example: (50 / 100) = 0.5;
                        const divisor = (triggerValue / 100);
                        // if property 1 update value = 50% of property 2 value
                        if (updateValue >= (property2Value * divisor)) {
                            Triggler._executeTrigger(trigger, entity);
                            break;
                        }
                    }
                    if (updateValue >= triggerValue) {
                        Triggler._executeTrigger(trigger, entity);
                    }
                    break;

                case DEFAULT_CONFIG.triggler.operators.lt:
                    if (isPercent) {
                        // example: (50 / 100) = 0.5;
                        const divisor = (triggerValue / 100);
                        // if property 1 update value = 50% of property 2 value
                        if (updateValue < (property2Value * divisor)) {
                            Triggler._executeTrigger(trigger, entity);
                            break;
                        }
                    }
                    if (updateValue < triggerValue) {
                        Triggler._executeTrigger(trigger, entity);
                    }
                    break;

                case DEFAULT_CONFIG.triggler.operators.lteq:
                    if (isPercent) {
                        // example: (50 / 100) = 0.5;
                        const divisor = (triggerValue / 100);
                        // if property 1 update value = 50% of property 2 value
                        if (updateValue <= (property2Value * divisor)) {
                            Triggler._executeTrigger(trigger, entity);
                            break;
                        }
                    }
                    if (updateValue <= triggerValue) {
                        Triggler._executeTrigger(trigger, entity);
                    }
                    break;
                
                case DEFAULT_CONFIG.triggler.operators.ne:
                    if (isPercent) {
                        // example: (50 / 100) = 0.5;
                        const divisor = (triggerValue / 100);
                        // if property 1 update value = 50% of property 2 value
                        if (updateValue !== (property2Value * divisor)) {
                            Triggler._executeTrigger(trigger, entity);
                            break;
                        }
                    }
                    if (updateValue !== triggerValue) {
                        Triggler._executeTrigger(trigger, entity);
                    }
                    break;
            
                default:
                    break;
            }
        }
    }

    /**
     * 
     * @param {*} actor 
     * @param {*} update 
     * @param {*} options 
     * @param {*} userId 
     */
    static _onUpdateActor(actor, update, options, userId) {
        if (game.userId !== userId) {
            return;
        }

        const dataProp = `data`;
        const dataDataProp = `data.data`;

        Triggler._processUpdate(actor, update, dataProp, dataDataProp);
    }

    /**
     * Update token handler
     * @param {*} scene 
     * @param {*} sceneId 
     * @param {*} update 
     * @param {*} options 
     * @param {*} userId 
     */
    static _onUpdateToken(scene, tokenData, update, options, userId) {
        if (game.userId !== userId) {
            return;
        }

        if (!hasProperty(update, "actorData.data")) {
            return;
        }

        const token = canvas.tokens.get(tokenData._id);
        const actorDataProp = `actorData.data`;
        const actorProp = `actor.data.data`;
        
        Triggler._processUpdate(token, update, actorDataProp, actorProp);
    }

    /**
     * 
     * @param {*} app 
     * @param {*} html 
     * @param {*} data 
     */
    static async _onRenderMacroConfig(app, html, data) {
        const typeSelect = html.find("select[name='type']");
        const typeSelectDiv = typeSelect.closest("div");
        const flag = app.object.getFlag(NAME, DEFAULT_CONFIG.triggler.flags.macro);
        const triggers = Sidekick.getSetting(SETTING_KEYS.triggler.triggers);

        const triggerSelectTemplate = DEFAULT_CONFIG.triggler.templatePaths.macroTriggerSelect;
        const triggerData = {
            flag,
            triggers
        }
        const triggerSelect = await renderTemplate(triggerSelectTemplate, triggerData);

        typeSelectDiv.after(triggerSelect);
    }
}