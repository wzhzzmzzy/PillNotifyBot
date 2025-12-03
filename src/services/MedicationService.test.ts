import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { MedicationService } from './MedicationService.js';
import { DataSource, type MedicationPlan } from '../db/index.js';
import { unlink } from 'fs/promises';

describe('MedicationService', () => {
  let medicationService: MedicationService;
  let dataSource: DataSource;
  const testDbPath = "test-medication.sqlite";

  beforeEach(() => {
    dataSource = new DataSource(testDbPath);
    medicationService = new MedicationService(dataSource);
  });

  afterEach(async () => {
    dataSource.term();
    try {
      await unlink(testDbPath);
      await unlink(testDbPath + "-wal");
      await unlink(testDbPath + "-shm");
    } catch {
      // 忽略文件不存在的错误
    }
  });

  describe('parseMedicationConfirmation', () => {
    test('应该正确解析基本的服药确认消息', () => {
      expect(medicationService.parseMedicationConfirmation('早上吃了')).toEqual({
        stageName: '早上'
      });

      expect(medicationService.parseMedicationConfirmation('中午吃了')).toEqual({
        stageName: '中午'
      });

      expect(medicationService.parseMedicationConfirmation('晚上吃了')).toEqual({
        stageName: '晚上'
      });

      expect(medicationService.parseMedicationConfirmation('睡前吃了')).toEqual({
        stageName: '睡前'
      });
    });

    test('应该正确解析复杂的阶段名称', () => {
      expect(medicationService.parseMedicationConfirmation('早餐后维生素吃了')).toEqual({
        stageName: '早餐后维生素'
      });

      expect(medicationService.parseMedicationConfirmation('睡前药物吃了')).toEqual({
        stageName: '睡前药物'
      });
    });

    test('应该处理带空格的输入', () => {
      expect(medicationService.parseMedicationConfirmation(' 早上吃了 ')).toEqual({
        stageName: '早上'
      });

      expect(medicationService.parseMedicationConfirmation('  中午 吃了  ')).toEqual({
        stageName: '中午'
      });
    });

    test('应该拒绝无效的输入格式', () => {
      expect(medicationService.parseMedicationConfirmation('早上')).toBeNull();
      expect(medicationService.parseMedicationConfirmation('吃了')).toBeNull();
      expect(medicationService.parseMedicationConfirmation('')).toBeNull();
      expect(medicationService.parseMedicationConfirmation('早上服药了')).toBeNull();
      expect(medicationService.parseMedicationConfirmation('我早上吃了药')).toBeNull();
    });

    test('应该拒绝空的阶段名称', () => {
      expect(medicationService.parseMedicationConfirmation('吃了')).toBeNull();
      expect(medicationService.parseMedicationConfirmation(' 吃了')).toBeNull();
    });
  });

  describe('getMedicationRecordsByDate', () => {
    test('应该返回指定日期的服药记录', () => {
      const testOwner = 'test_user';
      const targetDate = '2023-12-01';

      // 插入测试数据
      const insertStmt = dataSource.db.prepare(`
        INSERT INTO medication_records (create_at, stage, owner, medication_time)
        VALUES (?, ?, ?, ?)
      `);

      insertStmt.run(targetDate, 1, testOwner, '2023-12-01 08:00:00');
      insertStmt.run(targetDate, 2, testOwner, '2023-12-01 12:00:00');

      const result = medicationService.getMedicationRecordsByDate(testOwner, targetDate);

      expect(result).toHaveLength(2);
      expect(result[0].stage).toBe(1);
      expect(result[1].stage).toBe(2);
    });

    test('应该返回空数组当没有记录时', () => {
      const result = medicationService.getMedicationRecordsByDate('nonexistent_user', '2023-12-01');
      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('formatMedicationRecords', () => {
    test('应该正确格式化有记录的日期', () => {
      const testOwner = 'test_user';
      const targetDate = '2023-12-01';

      // 设置用户计划
      const testPlan: MedicationPlan = [
        { id: 1, name: '早上', time: '08:00', repeatInterval: 0 },
        { id: 2, name: '中午', time: '12:00', repeatInterval: 0 },
        { id: 3, name: '晚上', time: '20:00', repeatInterval: 0 }
      ];
      dataSource.createOrUpdateMedicationPlan(testOwner, testPlan);

      // 插入部分服药记录
      const insertStmt = dataSource.db.prepare(`
        INSERT INTO medication_records (create_at, stage, owner, medication_time)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run(targetDate, 1, testOwner, '2023-12-01 08:00:00'); // 早上已服药
      insertStmt.run(targetDate, 2, testOwner, '2023-12-01 12:00:00'); // 中午已服药

      const result = medicationService.formatMedicationRecords(testOwner, targetDate, '今天');

      expect(result).toBe('今天\n- 早上：已服药\n- 中午：已服药\n- 晚上：未服药');
    });

    test('应该正确格式化无记录的日期', () => {
      const testOwner = 'test_user';
      const targetDate = '2023-12-01';

      // 设置用户计划
      const testPlan: MedicationPlan = [
        { id: 1, name: '早上', time: '08:00', repeatInterval: 0 },
        { id: 2, name: '中午', time: '12:00', repeatInterval: 0 }
      ];
      dataSource.createOrUpdateMedicationPlan(testOwner, testPlan);

      const result = medicationService.formatMedicationRecords(testOwner, targetDate, '昨天');

      expect(result).toBe('昨天\n暂无服药记录');
    });

    test('应该处理用户无配置的情况', () => {
      const testOwner = 'test_user_no_plan';
      const targetDate = '2023-12-01';

      const result = medicationService.formatMedicationRecords(testOwner, targetDate, '今天');

      expect(result).toBe('❌ 您还没有配置任何服药计划，无法查看历史记录');
    });

    test('应该按配置顺序显示阶段，而不是记录时间顺序', () => {
      const testOwner = 'test_user';
      const targetDate = '2023-12-01';

      // 设置用户计划（特定顺序）
      const testPlan: MedicationPlan = [
        { id: 3, name: '晚上', time: '20:00', repeatInterval: 0 },
        { id: 1, name: '早上', time: '08:00', repeatInterval: 0 },
        { id: 2, name: '中午', time: '12:00', repeatInterval: 0 }
      ];
      dataSource.createOrUpdateMedicationPlan(testOwner, testPlan);

      // 插入服药记录（不同的时间顺序）
      const insertStmt = dataSource.db.prepare(`
        INSERT INTO medication_records (create_at, stage, owner, medication_time)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run(targetDate, 1, testOwner, '2023-12-01 08:00:00'); // 早上
      insertStmt.run(targetDate, 3, testOwner, '2023-12-01 20:00:00'); // 晚上

      const result = medicationService.formatMedicationRecords(testOwner, targetDate, '今天');

      // 应该按配置顺序显示：晚上、早上、中午
      expect(result).toBe('今天\n- 晚上：已服药\n- 早上：已服药\n- 中午：未服药');
    });

    test('应该正确处理复杂的阶段名称', () => {
      const testOwner = 'test_user';
      const targetDate = '2023-12-01';

      // 设置包含复杂名称的用户计划
      const testPlan: MedicationPlan = [
        { id: 1, name: '早餐后维生素', time: '08:30', repeatInterval: 0 },
        { id: 2, name: '午饭前降压药', time: '11:30', repeatInterval: 0 },
        { id: 3, name: '睡前钙片', time: '22:00', repeatInterval: 0 }
      ];
      dataSource.createOrUpdateMedicationPlan(testOwner, testPlan);

      // 插入一条记录
      const insertStmt = dataSource.db.prepare(`
        INSERT INTO medication_records (create_at, stage, owner, medication_time)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run(targetDate, 2, testOwner, '2023-12-01 11:30:00');

      const result = medicationService.formatMedicationRecords(testOwner, targetDate, '2023-12-01');

      expect(result).toBe('2023-12-01\n- 早餐后维生素：未服药\n- 午饭前降压药：已服药\n- 睡前钙片：未服药');
    });
  });
});