import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { MessageService } from './MessageService.js';
import { MedicationService } from './MedicationService.js';
import { PlanService } from './PlanService.js';
import { DataSource } from '../db/index.js';
import {
  MessageContext,
  StateActionType,
  MessageType
} from '../types/MessageState.js';

describe('MessageService', () => {
  let messageService: MessageService;
  let mockMedicationService: MedicationService;
  let mockPlanService: PlanService;
  let mockDataSource: DataSource;

  beforeEach(() => {
    // 创建内存数据库用于测试
    mockDataSource = new DataSource(':memory:');

    // 创建服务实例
    mockMedicationService = new MedicationService(mockDataSource);
    mockPlanService = new PlanService(mockDataSource);
    messageService = new MessageService(mockMedicationService, mockPlanService);

    // Mock 一些方法的返回值
    mockPlanService.generateTemplateData = mock(() => ({ Input: "测试模板数据" }));
    mockPlanService.clearUserConfiguration = mock(async () => ({
      message: "✅ 配置已清空",
      success: true
    }));
    mockPlanService.addStage = mock(async () => ({
      message: "✅ 已添加阶段",
      success: true
    }));
    mockPlanService.deleteStage = mock(async () => ({
      message: "✅ 已删除阶段",
      success: true
    }));
    mockMedicationService.parseMedicationConfirmation = mock(() => null);
    mockMedicationService.formatMedicationRecords = mock(() => '测试记录格式化结果');
  });

  describe('processMessage', () => {
    test('应该处理修改计划消息', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '修改计划'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(result.actions[0].payload.openId).toBe('test_user');
      expect(result.actions[0].payload.message.type).toBe(MessageType.CARD);
    });

    test('应该处理清空配置命令', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '清空配置'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(result.actions[0].payload.message.type).toBe(MessageType.TEXT);
      expect(result.actions[0].payload.message.content).toBe("✅ 配置已清空");
      expect(mockPlanService.clearUserConfiguration).toHaveBeenCalledWith('test_user');
    });

    test('应该处理初始化配置命令', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '初始化配置'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(mockPlanService.clearUserConfiguration).toHaveBeenCalledWith('test_user');
    });

    test('应该处理添加阶段命令（整点格式）', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '添加阶段早上，提醒时间8点'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2); // 发送消息 + 更新调度
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(result.actions[1].type).toBe(StateActionType.UPDATE_SCHEDULE);
      expect(mockPlanService.addStage).toHaveBeenCalledWith('test_user', '早上', 8, 0);
    });

    test('应该处理添加阶段命令（精确时间格式）', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '添加阶段中午，提醒时间12:30'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2);
      expect(mockPlanService.addStage).toHaveBeenCalledWith('test_user', '中午', 12, 30);
    });

    test('应该处理添加阶段命令（单位数分钟）', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '添加阶段下午，提醒时间14:5'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(mockPlanService.addStage).toHaveBeenCalledWith('test_user', '下午', 14, 5);
    });

    test('应该处理删除阶段命令', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '删除阶段早上'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2); // 发送消息 + 更新调度
      expect(mockPlanService.deleteStage).toHaveBeenCalledWith('test_user', '早上');
    });

    test('应该处理服药确认消息', async () => {
      // Mock 服药确认解析
      mockMedicationService.parseMedicationConfirmation = mock(() => ({
        stageName: '早上'
      }));
      mockPlanService.getActivePlan = mock(() => [
        { id: 1, name: '早上', time: '08:00', repeatInterval: 0 }
      ]);
      mockMedicationService.confirmMedication = mock(async () => ({
        message: '✅ 服药记录已更新',
        success: true
      }));

      const context: MessageContext = {
        openId: 'test_user',
        text: '早上吃了'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(mockMedicationService.confirmMedication).toHaveBeenCalledWith('test_user', 1, '早上');
    });

    test('应该处理历史记录查询 - 今天', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '今天'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(result.actions[0].payload.message.type).toBe(MessageType.TEXT);
      expect(result.actions[0].payload.message.content).toBe('测试记录格式化结果');
      expect(mockMedicationService.formatMedicationRecords).toHaveBeenCalled();
    });

    test('应该处理历史记录查询 - 昨天', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '昨天'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(mockMedicationService.formatMedicationRecords).toHaveBeenCalled();
    });

    test('应该处理历史记录查询 - 前天', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '前天'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(mockMedicationService.formatMedicationRecords).toHaveBeenCalled();
    });

    test('应该处理历史记录查询 - 具体日期 YYYY-MM-DD', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '2023-12-01'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(mockMedicationService.formatMedicationRecords).toHaveBeenCalledWith(
        'test_user',
        '2023-12-01',
        '2023-12-01'
      );
    });

    test('应该处理历史记录查询 - 具体日期 YYYY/MM/DD', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '2023/12/01'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      expect(mockMedicationService.formatMedicationRecords).toHaveBeenCalledWith(
        'test_user',
        '2023-12-01',
        '2023-12-01'
      );
    });

    test('应该处理服药确认 - 用户无配置', async () => {
      mockMedicationService.parseMedicationConfirmation = mock(() => ({
        stageName: '早上'
      }));
      mockPlanService.getActivePlan = mock(() => null);

      const context: MessageContext = {
        openId: 'test_user',
        text: '早上吃了'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(false);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].payload.message.content).toContain('还没有配置任何服药计划');
    });

    test('应该处理服药确认 - 阶段不匹配', async () => {
      mockMedicationService.parseMedicationConfirmation = mock(() => ({
        stageName: '下午'
      }));
      mockPlanService.getActivePlan = mock(() => [
        { id: 1, name: '早上', time: '08:00', repeatInterval: 0 },
        { id: 2, name: '晚上', time: '20:00', repeatInterval: 0 }
      ]);

      const context: MessageContext = {
        openId: 'test_user',
        text: '下午吃了'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(false);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].payload.message.content).toContain('没有"下午"阶段');
      expect(result.actions[0].payload.message.content).toContain('早上、晚上');
    });

    test('应该处理未知消息类型', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '这是一个未知的消息'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe(StateActionType.NO_ACTION);
    });

    test('应该处理添加阶段失败的情况', async () => {
      mockPlanService.addStage = mock(async () => ({
        message: "❌ 添加失败",
        success: false
      }));

      const context: MessageContext = {
        openId: 'test_user',
        text: '添加阶段测试，提醒时间10点'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(false);
      expect(result.actions).toHaveLength(1); // 只有发送消息，没有更新调度
      expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
    });

    test('应该处理异常情况', async () => {
      mockPlanService.clearUserConfiguration = mock(async () => {
        throw new Error('数据库错误');
      });

      const context: MessageContext = {
        openId: 'test_user',
        text: '清空配置'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].payload.message.content).toContain('错误');
    });

    test('应该正确解析复杂的阶段名称', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '添加阶段睡前维生素，提醒时间22:30'
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(mockPlanService.addStage).toHaveBeenCalledWith('test_user', '睡前维生素', 22, 30);
    });

    test('应该正确处理带空格的阶段名称', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '删除阶段 早上 '
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(mockPlanService.deleteStage).toHaveBeenCalledWith('test_user', '早上');
    });
  });

  describe('边界情况测试', () => {
    test('应该处理空的消息文本', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: ''
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions[0].type).toBe(StateActionType.NO_ACTION);
    });

    test('应该处理只有空格的消息', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '   '
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions[0].type).toBe(StateActionType.NO_ACTION);
    });

    test('应该处理格式不正确的添加阶段命令', async () => {
      const context: MessageContext = {
        openId: 'test_user',
        text: '添加阶段早上提醒时间8点' // 缺少逗号
      };

      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(result.actions[0].type).toBe(StateActionType.NO_ACTION);
    });
  });

  describe('日期解析测试', () => {
    test('应该正确解析相对日期', async () => {
      const todayContext: MessageContext = { openId: 'test_user', text: '今天' };
      const yesterdayContext: MessageContext = { openId: 'test_user', text: '昨天' };
      const dayBeforeContext: MessageContext = { openId: 'test_user', text: '前天' };

      // 所有相对日期都应该被识别为历史查询
      expect((await messageService.processMessage(todayContext)).success).toBe(true);
      expect((await messageService.processMessage(yesterdayContext)).success).toBe(true);
      expect((await messageService.processMessage(dayBeforeContext)).success).toBe(true);
    });

    test('应该正确解析绝对日期格式', async () => {
      const dateFormats = [
        '2023-12-01',
        '2023/12/01',
        '2023-1-1',
        '2023/1/1'
      ];

      for (const dateFormat of dateFormats) {
        const context: MessageContext = { openId: 'test_user', text: dateFormat };
        const result = await messageService.processMessage(context);
        expect(result.success).toBe(true);
        expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      }
    });

    test('应该拒绝无效的日期格式', async () => {
      const invalidDates = [
        '2023-13-01', // 无效月份
        '2023-12-32', // 无效日期
        '2023/02/30', // 2月没有30号
        '2023-2-29',  // 非闰年的2月29号
        'abc-12-01',  // 无效年份
        '2023-ab-01', // 无效月份
        '2023-12-ab', // 无效日期
        '23-12-01',   // 年份太短
        '12-01',      // 缺少年份
        '2023',       // 只有年份
        '今天的记录', // 包含额外文字
        '昨天怎么样', // 包含额外文字
      ];

      for (const invalidDate of invalidDates) {
        const context: MessageContext = { openId: 'test_user', text: invalidDate };
        const result = await messageService.processMessage(context);
        // 无效日期应该被当作未知消息处理
        expect(result.actions[0].type).toBe(StateActionType.NO_ACTION);
      }
    });

    test('应该正确处理边界日期', async () => {
      const boundaryDates = [
        '2023-01-01', // 年初
        '2023-12-31', // 年末
        '2024-02-29', // 闰年2月29号
        '2023-02-28', // 平年2月28号
      ];

      for (const date of boundaryDates) {
        const context: MessageContext = { openId: 'test_user', text: date };
        const result = await messageService.processMessage(context);
        expect(result.success).toBe(true);
        expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      }
    });

    test('应该正确处理日期前后的空格', async () => {
      const spacedDates = [
        ' 今天 ',
        '  昨天  ',
        ' 2023-12-01 ',
        '  2023/12/01  '
      ];

      for (const date of spacedDates) {
        const context: MessageContext = { openId: 'test_user', text: date };
        const result = await messageService.processMessage(context);
        expect(result.success).toBe(true);
        expect(result.actions[0].type).toBe(StateActionType.SEND_MESSAGE);
      }
    });

    test('应该确保日期计算的准确性', async () => {
      // 这个测试确保日期计算是正确的，虽然我们无法控制当前时间
      // 但我们可以验证调用是否正确
      const context: MessageContext = { openId: 'test_user', text: '昨天' };
      const result = await messageService.processMessage(context);

      expect(result.success).toBe(true);
      expect(mockMedicationService.formatMedicationRecords).toHaveBeenCalled();

      // 验证调用参数的格式是否正确 (YYYY-MM-DD)
      const callArgs = mockMedicationService.formatMedicationRecords.mock.calls[0];
      expect(callArgs[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/); // 日期格式
      expect(callArgs[2]).toBe('昨天'); // 显示名称
    });
  });
});