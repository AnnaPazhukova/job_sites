import { useEffect, useMemo, useState } from "react";
import { Check, GripVertical, Layers, ListPlus, Plus, Search, Trash2, X } from "lucide-react";
import { Card, GhostButton, Modal, PageHeader, Pill, PrimaryButton, Select, TextArea, TextInput } from "../components/ui";
import { AttachmentsField } from "../components/Attachments";
import { GRADES, uid } from "../lib/utils";
import type { Attachment, MethodNote, MethodNoteAttachments, MethodNoteTabKey, MethodNoteTabs, Task } from "../lib/types";

const subjectsForGrade = (grade: string) => {
  if (grade === "5 класс" || grade === "6 класс") return ["Математика"];
  if (grade === "9 класс") return ["Алгебра", "Геометрия", "ОГЭ-Матем", "ОГЭ-Инфа"];
  return ["Алгебра", "Геометрия"];
};
const ALL_SUBJECTS = ["Математика", "Алгебра", "Геометрия", "ОГЭ-Матем", "ОГЭ-Инфа"];
// Legacy label for what's now "ОГЭ-Матем" — notes saved under the old name
// before this rename still carry it verbatim in stored data (subject is
// snapshotted on the note, not looked up live), so anywhere a subject is
// read for display/filtering it needs mapping through this first.
const LEGACY_SUBJECT_ALIASES: Record<string, string> = { "Подготовка к ОГЭ": "ОГЭ-Матем" };
function displaySubject(subject: string): string {
  return LEGACY_SUBJECT_ALIASES[subject] || subject;
}
const NOTE_GRADES = GRADES.filter((g) => g !== "10 класс" && g !== "11 класс");

const OGE_PREP_TEMPLATE = `Работа с текстом задания: чтение условия, планы участков, схемы
Вычисления по условию текста (задания 1–5), единицы измерения
Задание 6 — числа и вычисления: действия с обыкновенными и десятичными дробями
Задание 6 — числа и вычисления: степени, стандартный вид числа, проценты
Задание 7 — числовые неравенства, координатная прямая: сравнение чисел, отметка на координатной прямой, свойства неравенств
Задание 8 — алгебраические выражения: формулы сокращённого умножения
Задание 8 — алгебраические выражения: преобразование выражений и дробей
Задание 9 — уравнения и системы: линейные уравнения и системы
Задание 9 — уравнения и системы: квадратные уравнения
Задание 9 — уравнения и системы: дробно-рациональные уравнения
Задание 10 — статистика и вероятности: классическая вероятность
Задание 10 — статистика и вероятности: комбинаторика, круги Эйлера
Задание 11 — графики функций: линейная функция и её график
Задание 11 — графики функций: квадратичная функция, парабола
Задание 11 — графики функций: обратная пропорциональность (гипербола)
Задание 12 — расчёты по формулам: прикладные формулы (тарифы, физические величины)
Задание 13 — неравенства и системы: линейные неравенства
Задание 13 — неравенства и системы: квадратные неравенства, метод интервалов
Задание 13 — неравенства и системы: системы неравенств
Задание 14 — прогрессии: арифметическая прогрессия
Задание 14 — прогрессии: геометрическая прогрессия
Задание 15 — треугольники и многоугольники: признаки равенства, свойства треугольников
Задание 15 — треугольники и многоугольники: теорема Пифагора, тригонометрия прямоугольного треугольника
Задание 15 — треугольники и многоугольники: подобие треугольников
Задание 15 — треугольники и многоугольники: параллелограмм, трапеция и их свойства
Задание 16 — окружность и круг: хорды, касательные, центральные и вписанные углы
Задание 16 — окружность и круг: вписанная и описанная окружности
Задание 17 — площади фигур: площади треугольников и четырёхугольников
Задание 17 — площади фигур: площади фигур сложной формы, круга и его частей
Задание 18 — фигуры на решётке: площади и длины на клетчатой бумаге
Задание 18 — фигуры на решётке: углы, построение и измерение фигур
Задание 19 — анализ геометрических утверждений: разбор верных/неверных утверждений
Задание 20: сложные уравнения и неравенства повышенного уровня
Задание 21: текстовые задачи (движение, работа, смеси)
Задание 22: функции и их свойства, построение и анализ графиков
Задание 23: геометрическая задача на вычисление
Задание 24: геометрическая задача на доказательство
Задание 25: комплексная геометрическая задача повышенной сложности
Сводное повторение части 1 (задания 1–19): разбор сложных случаев по темам
Сводное повторение части 2 (задания 20–25): разбор сложных случаев по темам`;

const ALGEBRA_7_TEMPLATE = `Рациональные числа: повторение, действия
Числовые выражения
Выражения с переменными
Сравнение значений выражений
Свойства действий над числами
Тождества, тождественные преобразования выражений (практика)
Уравнение и его корни
Линейное уравнение с одной переменной
Решение задач с помощью уравнений (часть 1)
Решение задач с помощью уравнений (часть 2)
Формулы, выражение переменной из формулы
Контрольная работа №1 + разбор ошибок
Числовые промежутки
Что такое функция, область определения
Вычисление значений функции по формуле
График функции
Прямая пропорциональность и её график
Линейная функция и её график
Кусочно-заданные функции; контрольная работа №2
Определение степени с натуральным показателем
Умножение и деление степеней
Возведение в степень произведения и степени (практика)
Одночлен и его стандартный вид
Умножение одночленов
Возведение одночлена в степень
Функции у = x² и y = x³ и их графики; простые и составные числа; контрольная работа №3
Многочлен и его стандартный вид
Сложение и вычитание многочленов
Умножение одночлена на многочлен
Вынесение общего множителя за скобки (практика)
Умножение многочлена на многочлен
Разложение многочлена на множители способом группировки
Деление с остатком; контрольная работа №4
Квадрат суммы и квадрат разности
Разложение на множители с помощью квадрата суммы и разности
Практика: применение квадрата суммы/разности в вычислениях
Умножение разности двух выражений на их сумму
Разложение разности квадратов на множители
Практика: разность квадратов в комбинированных заданиях
Сумма и разность кубов, разложение на множители
Преобразование целого выражения в многочлен
Применение различных способов разложения на множители (сводная практика)
Возведение двучлена в степень; контрольная работа №5
Линейное уравнение с двумя переменными; график
Системы линейных уравнений с двумя переменными
Решение систем способом подстановки
Решение систем способом сложения
Решение задач с помощью систем уравнений (практика)
Линейные неравенства с двумя переменными и их системы
Итоговая контрольная работа за год + разбор`;

const MATH_5_TEMPLATE = `Обозначение натуральных чисел
Отрезок. Длина отрезка. Треугольник
Плоскость, прямая, луч
Шкалы и координаты
Сравнение натуральных чисел
Сложение натуральных чисел, свойства сложения
Вычитание натуральных чисел
Числовые и буквенные выражения
Буквенная запись свойств сложения и вычитания
Уравнение
Угол, обозначение углов
Виды углов, измерение углов
Многоугольники, равные фигуры
Треугольник и его виды
Прямоугольник, ось симметрии фигуры
Умножение натуральных чисел, свойства умножения
Буквенная запись свойств умножения
Распределительное свойство умножения
Деление натуральных чисел
Деление с остатком
Упрощение выражений
Порядок выполнения действий
Степень числа: квадрат и куб числа
Площадь, площадь прямоугольника
Единицы измерения площадей
Прямоугольный параллелепипед
Объём, объём прямоугольного параллелепипеда
Круг и окружность
Доли, обыкновенные дроби
Сравнение дробей
Правильные и неправильные дроби
Сложение и вычитание дробей с одинаковыми знаменателями
Деление и дроби
Смешанные числа
Сложение смешанных чисел
Вычитание смешанных чисел
Десятичная запись дробных чисел
Сравнение десятичных дробей
Сложение и вычитание десятичных дробей
Приближённое значение чисел, округление
Умножение десятичных дробей на натуральное число
Деление десятичной дроби на натуральное число
Умножение десятичных дробей
Деление на десятичную дробь
Среднее арифметическое
Проценты, нахождение процентов от числа
Прямой и развёрнутый угол, чертёжный треугольник
Транспортир: измерение и построение углов
Круговые диаграммы
Нахождение числа по его процентам
Итоговое повторение курса 5 класса`;

const MATH_6_TEMPLATE = `Делители и кратные
Признаки делимости на 10, на 5 и на 2
Признаки делимости на 9 и на 3
Простые и составные числа
Разложение на простые множители
Наибольший общий делитель, взаимно простые числа
Наименьшее общее кратное
Основное свойство дроби
Сокращение дробей
Приведение дробей к общему знаменателю
Сравнение дробей с разными знаменателями
Сложение и вычитание дробей с разными знаменателями
Сложение и вычитание смешанных чисел
Умножение дробей
Нахождение дроби от числа
Взаимно обратные числа
Деление дробей
Нахождение числа по его дроби
Дробные выражения
Отношения
Пропорции
Прямая и обратная пропорциональности
Масштаб
Длина окружности и площадь круга
Шар
Положительные и отрицательные числа
Координаты на прямой
Противоположные числа
Модуль числа
Сравнение чисел
Изменение величин
Сложение чисел с помощью координатной прямой
Сложение отрицательных чисел
Сложение чисел с разными знаками
Вычитание
Умножение чисел с разными знаками
Умножение отрицательных чисел
Деление чисел с разными знаками
Рациональные числа
Свойства действий над числами
Раскрытие скобок
Коэффициент, подобные слагаемые
Решение уравнений
Перпендикулярные прямые
Осевая и центральная симметрии
Параллельные прямые
Координатная плоскость
Столбчатые диаграммы и графики
Итоговое повторение курса 6 класса`;

const GEOMETRY_7_TEMPLATE = `Точка, прямая, отрезок — основные понятия
Луч и угол, виды углов
Сравнение отрезков и углов, измерение отрезков
Измерение углов, транспортир
Смежные и вертикальные углы, их свойства
Перпендикулярные прямые
Треугольник и его элементы
Первый признак равенства треугольников
Медианы, биссектрисы и высоты треугольника
Равнобедренный треугольник и его свойства
Второй признак равенства треугольников
Третий признак равенства треугольников
Окружность: хорда, радиус, касательная
Задачи на построение циркулем и линейкой
Построение угла, равного данному; биссектриса угла
Признаки параллельности прямых по накрест лежащим углам
Признаки параллельности по соответственным и односторонним углам
Аксиома параллельных прямых и следствия из неё
Свойства углов при параллельных прямых и секущей
Сумма углов треугольника
Внешний угол треугольника
Соотношения между сторонами и углами треугольника
Неравенство треугольника
Прямоугольный треугольник: свойства
Признаки равенства прямоугольных треугольников
Расстояние от точки до прямой, между параллельными прямыми
Построение треугольника по трём элементам
Повторение: признаки равенства треугольников
Повторение: параллельные прямые и углы
Итоговая контрольная работа за курс 7 класса`;

const ALGEBRA_8_TEMPLATE = `Рациональные дроби и их свойства
Основное свойство дроби, сокращение дробей
Сложение и вычитание дробей с одинаковыми знаменателями
Сложение и вычитание дробей с разными знаменателями
Умножение дробей, возведение дроби в степень
Деление дробей
Преобразование рациональных выражений
Функция y = k/x и её график
Контрольная работа: рациональные дроби
Рациональные и иррациональные числа
Арифметический квадратный корень
Уравнение x² = a
Свойства арифметического квадратного корня
Тождественные преобразования выражений с квадратными корнями
Функция y = √x и её график
Контрольная работа: квадратные корни
Понятие квадратного уравнения, неполные квадратные уравнения
Формула корней квадратного уравнения
Решение задач с помощью квадратных уравнений
Теорема Виета
Контрольная работа: квадратные уравнения
Дробно-рациональные уравнения
Решение задач с помощью дробно-рациональных уравнений
Контрольная работа: дробно-рациональные уравнения
Числовые неравенства и их свойства
Сложение и умножение числовых неравенств
Пересечение и объединение множеств, числовые промежутки
Решение неравенств с одной переменной
Решение систем неравенств с одной переменной
Контрольная работа: неравенства
Степень с целым показателем и её свойства
Стандартный вид числа, приближённые вычисления
Функция y = x⁻ⁿ и её график
Элементы статистики: сбор, группировка и представление данных
Контрольная работа: степени и статистика
Итоговое повторение курса 8 класса`;

const GEOMETRY_8_TEMPLATE = `Многоугольник, выпуклый многоугольник, четырёхугольник
Параллелограмм и его свойства
Признаки параллелограмма
Трапеция: равнобедренная и прямоугольная
Прямоугольник и его свойства
Ромб и квадрат
Осевая и центральная симметрия фигур
Контрольная работа: четырёхугольники
Площадь многоугольника
Площадь параллелограмма
Площадь треугольника
Площадь трапеции
Теорема Пифагора
Теорема, обратная теореме Пифагора
Контрольная работа: площади
Определение подобных треугольников, отношение площадей
Первый признак подобия треугольников
Второй и третий признаки подобия треугольников
Средняя линия треугольника
Свойство биссектрисы треугольника
Пропорциональные отрезки, практическое применение подобия
Синус, косинус, тангенс острого угла прямоугольного треугольника
Соотношения между сторонами и углами прямоугольного треугольника
Контрольная работа: подобие треугольников
Взаимное расположение прямой и окружности
Касательная к окружности и её свойства
Центральные и вписанные углы
Теорема о вписанном угле
Свойство биссектрисы угла и серединного перпендикуляра
Вписанная окружность
Описанная окружность
Контрольная работа: окружность
Итоговое повторение курса 8 класса`;

const ALGEBRA_9_TEMPLATE = `Функции и их свойства
Квадратный трёхчлен, его корни, разложение на множители
Функция y = ax² + bx + c, её свойства и график
Степенная функция, корень n-й степени
Контрольная работа: функции
Целое уравнение и его корни
Уравнения, приводимые к квадратным
Дробно-рациональные уравнения
Решение неравенств второй степени с одной переменной
Решение неравенств методом интервалов
Контрольная работа: уравнения и неравенства
Уравнение с двумя переменными и его график
Графический способ решения систем уравнений
Решение систем уравнений второй степени
Решение задач с помощью систем уравнений
Неравенства с двумя переменными и их системы
Контрольная работа: системы уравнений
Последовательности
Арифметическая прогрессия: определение, формула n-го члена
Сумма n первых членов арифметической прогрессии
Геометрическая прогрессия: определение, формула n-го члена
Сумма n первых членов геометрической прогрессии
Сумма бесконечной геометрической прогрессии при |q| < 1
Контрольная работа: прогрессии
Примеры комбинаторных задач
Перестановки, размещения, сочетания
Относительная частота случайного события
Вероятность случайного события
Сложение и умножение вероятностей
Контрольная работа: комбинаторика и вероятность
Повторение: уравнения и неравенства
Повторение: функции и графики
Итоговое повторение курса 7–9 классов`;

const GEOMETRY_9_TEMPLATE = `Синус, косинус, тангенс и котангенс угла
Теорема о площади треугольника
Теоремы синусов и косинусов
Решение треугольников
Скалярное произведение векторов
Контрольная работа: соотношения в треугольниках, векторы
Правильные многоугольники
Окружность, описанная около правильного многоугольника
Окружность, вписанная в правильный многоугольник
Длина окружности
Площадь круга и кругового сектора
Контрольная работа: длина окружности и площадь круга
Понятие движения, параллельный перенос
Осевая и центральная симметрии как виды движения
Поворот
Контрольная работа: движения
Начальные сведения из стереометрии: многогранники
Начальные сведения из стереометрии: тела вращения
Повторение: треугольники
Повторение: четырёхугольники и многоугольники
Повторение: окружность
Итоговое повторение курса планиметрии 7–9 классов`;

const OGE_INFO_TEMPLATE = `Информация, её представление и измерение; единицы измерения информации
Кодирование информации, равномерные и неравномерные коды
Системы счисления: перевод чисел между системами
Элементы алгебры логики: таблицы истинности, логические операции
Логические выражения и их преобразование
Множества и операции над ними, диаграммы Эйлера — Венна
Файловая система: путь к файлу, маска имени файла
Оценка количественных параметров объектов и процессов (задание 1)
Работа с электронной таблицей: поиск и вычисление значений
Поиск информации в диаграммах, схемах, графах
Кодирование и обработка текста в текстовом процессоре
Построение и анализ схем, графов, деревьев
Определение объёма памяти для графической и звуковой информации
Обработка числовой информации в таблицах, построение диаграмм
Алгоритм для формального исполнителя (Робот/Чертёжник)
Составление алгоритма по описанию для исполнителя
Программирование: линейные, ветвящиеся и циклические алгоритмы
Обработка массивов данных в программе
Составление и отладка программы с ветвлениями и циклами
Работа с файлами в языке программирования
Повторение: логика и системы счисления
Повторение: алгоритмизация и программирование
Разбор демоверсии ОГЭ по информатике и типичных ошибок`;

const BULK_TEMPLATES: Record<string, string> = {
  "5 класс|Математика": MATH_5_TEMPLATE,
  "6 класс|Математика": MATH_6_TEMPLATE,
  "7 класс|Алгебра": ALGEBRA_7_TEMPLATE,
  "7 класс|Геометрия": GEOMETRY_7_TEMPLATE,
  "8 класс|Алгебра": ALGEBRA_8_TEMPLATE,
  "8 класс|Геометрия": GEOMETRY_8_TEMPLATE,
  "9 класс|Алгебра": ALGEBRA_9_TEMPLATE,
  "9 класс|Геометрия": GEOMETRY_9_TEMPLATE,
  "9 класс|ОГЭ-Матем": OGE_PREP_TEMPLATE,
  "9 класс|ОГЭ-Инфа": OGE_INFO_TEMPLATE,
};

const TAB_ORDER: MethodNoteTabKey[] = ["theory", "rules", "tasks", "test", "homework"];
const TAB_LABELS: Record<MethodNoteTabKey, string> = {
  theory: "Теория",
  rules: "Правила",
  tasks: "Задания",
  test: "Тест",
  homework: "Д/З",
};
const TAB_PLACEHOLDERS: Record<MethodNoteTabKey, string> = {
  theory: "Как вы вводите тему, в каком порядке — понятия, приёмы, аналогии...",
  rules: "Формулировки правил, формулы. Сюда же удобно прикреплять фото страниц учебника.",
  tasks: "Задания для отработки темы на занятии.",
  test: "Проверочная работа/тест по теме.",
  homework: "Что обычно задаёте на дом по этой теме.",
};

const EMPTY_TABS: MethodNoteTabs = { theory: "", rules: "", tasks: "", test: "", homework: "" };

function getTabs(note: MethodNote | null): MethodNoteTabs {
  if (!note) return EMPTY_TABS;
  if (note.tabs) return note.tabs;
  return { ...EMPTY_TABS, theory: note.content || "" };
}

const emptyNote = (): MethodNote => ({
  id: uid(),
  topic: "",
  grade: NOTE_GRADES[1],
  subject: "Математика",
  tabs: { ...EMPTY_TABS },
  updatedAt: Date.now(),
});

interface Props {
  notes: MethodNote[];
  saveNotes: (n: MethodNote[]) => void;
  tasks: Task[];
  showToast: (t: string) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

export function NotesView({ notes, saveNotes, tasks, showToast, activeId, setActiveId }: Props) {
  const [creating, setCreating] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const active = notes.find((n) => n.id === activeId) || null;

  const [activeTab, setActiveTab] = useState<MethodNoteTabKey>("theory");
  const [draftTabs, setDraftTabs] = useState<MethodNoteTabs>(getTabs(active));

  useEffect(() => {
    setDraftTabs(getTabs(active));
    setActiveTab("theory");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const [gradeFilter, setGradeFilter] = useState("Все классы");
  const [subjectFilter, setSubjectFilter] = useState("Все предметы");
  const [query, setQuery] = useState("");

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (gradeFilter !== "Все классы" && n.grade !== gradeFilter) return false;
      if (subjectFilter !== "Все предметы" && displaySubject(n.subject) !== subjectFilter) return false;
      if (query.trim() && !n.topic.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [notes, gradeFilter, subjectFilter, query]);

  const relatedCount = active ? tasks.filter((t) => t.topic === active.topic).length : 0;

  const [newGrade, setNewGrade] = useState(NOTE_GRADES[1]);
  const [newSubject, setNewSubject] = useState("Математика");

  const handleCreate = () => {
    if (!newTopic.trim()) return;
    const note = { ...emptyNote(), topic: newTopic.trim(), grade: newGrade, subject: newSubject };
    saveNotes([...notes, note]);
    setActiveId(note.id);
    setNewTopic("");
    setCreating(false);
    showToast("Тема методики создана");
  };

  const handleSaveDraft = () => {
    if (!active) return;
    saveNotes(notes.map((n) => (n.id === active.id ? { ...n, tabs: draftTabs, updatedAt: Date.now() } : n)));
    showToast("Заметка сохранена");
  };

  const handleAttachmentsChange = (tabKey: MethodNoteTabKey, next: Attachment[]) => {
    if (!active) return;
    const nextAttachments: MethodNoteAttachments = { ...(active.attachments || {}), [tabKey]: next };
    saveNotes(notes.map((n) => (n.id === active.id ? { ...n, attachments: nextAttachments, updatedAt: Date.now() } : n)));
  };

  const handleDelete = (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    saveNotes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPos, setOverPos] = useState<"before" | "after" | null>(null);

  const moveNote = (draggedId: string, targetId: string, after: boolean) => {
    if (draggedId === targetId) return;
    const list = [...notes];
    const fromIndex = list.findIndex((n) => n.id === draggedId);
    const targetNote = list.find((n) => n.id === targetId);
    if (fromIndex === -1 || !targetNote || list[fromIndex].grade !== targetNote.grade) return;
    const [item] = list.splice(fromIndex, 1);
    let toIndex = list.findIndex((n) => n.id === targetId);
    toIndex = after ? toIndex + 1 : toIndex;
    list.splice(toIndex, 0, item);
    saveNotes(list);
  };

  const endDrag = () => {
    setDragId(null);
    setOverId(null);
    setOverPos(null);
  };

  const handleBulkAdd = (grade: string, subject: string, lines: string[]) => {
    const newNotes = lines.map((topic) => ({ ...emptyNote(), topic, grade, subject }));
    if (newNotes.length === 0) return;
    saveNotes([...notes, ...newNotes]);
    setShowBulkAdd(false);
    showToast(`Добавлено тем: ${newNotes.length}`);
  };

  return (
    <div>
      <PageHeader title="Методика" subtitle="Как вы объясняете темы: порядок подачи, приёмы, разбор типичных ошибок" />

      <Card className="p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <TextInput placeholder="Поиск по теме..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="w-40">
            <Select value={gradeFilter} onChange={setGradeFilter} options={["Все классы", ...NOTE_GRADES]} />
          </div>
          <div className="w-44">
            <Select value={subjectFilter} onChange={setSubjectFilter} options={["Все предметы", ...ALL_SUBJECTS]} />
          </div>
        </div>
      </Card>

      <div className="flex gap-4 flex-col md:flex-row">
        <div className="md:w-[260px] shrink-0">
          <PrimaryButton icon={Plus} full onClick={() => setCreating(true)}>
            Тема методики
          </PrimaryButton>
          <div className="mt-2">
            <GhostButton icon={ListPlus} full onClick={() => setShowBulkAdd(true)}>
              Добавить список тем
            </GhostButton>
          </div>
          {creating && (
            <Card className="mt-2 p-3 space-y-2">
              <TextInput
                autoFocus
                placeholder="Название темы"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-1.5">
                <Select
                  value={newGrade}
                  onChange={(v) => {
                    const opts = subjectsForGrade(v);
                    setNewGrade(v);
                    if (!opts.includes(newSubject)) setNewSubject(opts[0]);
                  }}
                  options={NOTE_GRADES}
                />
                <Select value={newSubject} onChange={setNewSubject} options={subjectsForGrade(newGrade)} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8]">
                  <Check size={14} /> Создать
                </button>
                <button onClick={() => setCreating(false)} className="px-3 rounded-lg text-gray-400 hover:bg-gray-100">
                  <X size={16} />
                </button>
              </div>
            </Card>
          )}

          <div className="mt-2 space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {NOTE_GRADES.filter((g) => filteredNotes.some((n) => n.grade === g)).map((g) => (
              <div key={g}>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold px-2 pt-3 pb-1">{g}</div>
                {filteredNotes
                  .filter((n) => n.grade === g)
                  .map((n) => (
                    <NoteRow
                      key={n.id}
                      note={n}
                      active={n.id === activeId}
                      dragging={dragId === n.id}
                      dropIndicator={overId === n.id ? overPos : null}
                      onClick={() => setActiveId(n.id)}
                      onDelete={() => handleDelete(n.id)}
                      onDragStart={() => setDragId(n.id)}
                      onDragEndRow={endDrag}
                      onDragOverRow={(pos) => {
                        setOverId(n.id);
                        setOverPos(pos);
                      }}
                      onDropRow={() => {
                        if (dragId) moveNote(dragId, n.id, overPos === "after");
                        endDrag();
                      }}
                    />
                  ))}
              </div>
            ))}
            {filteredNotes.filter((n) => !NOTE_GRADES.includes(n.grade)).map((n) => (
              <NoteRow
                key={n.id}
                note={n}
                active={n.id === activeId}
                dragging={dragId === n.id}
                dropIndicator={overId === n.id ? overPos : null}
                onClick={() => setActiveId(n.id)}
                onDelete={() => handleDelete(n.id)}
                onDragStart={() => setDragId(n.id)}
                onDragEndRow={endDrag}
                onDragOverRow={(pos) => {
                  setOverId(n.id);
                  setOverPos(pos);
                }}
                onDropRow={() => {
                  if (dragId) moveNote(dragId, n.id, overPos === "after");
                  endDrag();
                }}
              />
            ))}
            {filteredNotes.length === 0 && !creating && (
              <p className="text-xs text-gray-400 px-2 py-4">
                {notes.length === 0 ? "Нет тем. Начните с той, что объясняете чаще всего." : "Ничего не найдено по этим фильтрам."}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {active ? (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg">{active.topic}</h3>
                  {active.grade && <Pill tone="level">{active.grade}</Pill>}
                  {active.subject && <Pill>{displaySubject(active.subject)}</Pill>}
                </div>
                <div className="flex items-center gap-2">
                  {relatedCount > 0 && <Pill tone="type">{relatedCount} задач в базе</Pill>}
                  <button
                    onClick={() => {
                      if (window.confirm(`Удалить тему «${active.topic}»?`)) handleDelete(active.id);
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                    title="Удалить тему"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex gap-1 mb-4 border-b border-[#F0F1F4] overflow-x-auto">
                {TAB_ORDER.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                      activeTab === tab ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>

              <TextArea
                key={activeTab}
                className="min-h-[300px] text-sm"
                placeholder={TAB_PLACEHOLDERS[activeTab]}
                value={draftTabs[activeTab]}
                onChange={(e) => setDraftTabs((t) => ({ ...t, [activeTab]: e.target.value }))}
                onBlur={handleSaveDraft}
              />

              <div className="mt-4">
                <AttachmentsField
                  attachments={active.attachments?.[activeTab] || []}
                  onChange={(next) => handleAttachmentsChange(activeTab, next)}
                />
              </div>

              <div className="flex justify-end mt-4">
                <PrimaryButton icon={Check} onClick={handleSaveDraft}>
                  Сохранить
                </PrimaryButton>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center text-center py-20 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
                <Layers size={28} strokeWidth={1.6} />
              </div>
              <div className="text-gray-500 text-sm">Выберите тему слева или создайте новую.</div>
            </Card>
          )}
        </div>
      </div>

      {showBulkAdd && <BulkAddModal onClose={() => setShowBulkAdd(false)} onSubmit={handleBulkAdd} />}
    </div>
  );
}

function BulkAddModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (grade: string, subject: string, lines: string[]) => void;
}) {
  const [grade, setGrade] = useState("7 класс");
  const [subject, setSubject] = useState("Алгебра");
  const [text, setText] = useState(ALGEBRA_7_TEMPLATE);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <Modal title="Добавить список тем" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <Select
            value={grade}
            onChange={(v) => {
              const opts = subjectsForGrade(v);
              const nextSubject = opts.includes(subject) ? subject : opts[0];
              setGrade(v);
              setSubject(nextSubject);
              setText(BULK_TEMPLATES[`${v}|${nextSubject}`] || "");
            }}
            options={NOTE_GRADES}
          />
          <Select
            value={subject}
            onChange={(v) => {
              setSubject(v);
              setText(BULK_TEMPLATES[`${grade}|${v}`] || "");
            }}
            options={subjectsForGrade(grade)}
          />
        </div>
        <TextArea
          className="min-h-[320px] text-sm font-mono"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="По одной теме на строку"
        />
        <div className="text-xs text-gray-400">Тем к добавлению: {lines.length}</div>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Отмена</GhostButton>
          <PrimaryButton icon={ListPlus} onClick={() => onSubmit(grade, subject, lines)} disabled={lines.length === 0}>
            Добавить{lines.length > 0 ? ` (${lines.length})` : ""}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NoteRow({
  note,
  active,
  dragging,
  dropIndicator,
  onClick,
  onDelete,
  onDragStart,
  onDragEndRow,
  onDragOverRow,
  onDropRow,
}: {
  note: MethodNote;
  active: boolean;
  dragging: boolean;
  dropIndicator: "before" | "after" | null;
  onClick: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEndRow: () => void;
  onDragOverRow: (pos: "before" | "after") => void;
  onDropRow: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEndRow}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onDragOverRow(e.clientY - rect.top > rect.height / 2 ? "after" : "before");
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropRow();
      }}
      onClick={onClick}
      className={`group flex items-center gap-1 px-1.5 py-2 rounded-lg cursor-pointer text-sm transition-colors border-t-2 border-b-2 ${
        active ? "bg-[#EEF2FF] text-[#2563EB] font-medium" : "text-gray-600 hover:bg-gray-50"
      } ${dragging ? "opacity-40" : ""} ${dropIndicator === "before" ? "border-t-[#2563EB]" : "border-t-transparent"} ${
        dropIndicator === "after" ? "border-b-[#2563EB]" : "border-b-transparent"
      }`}
    >
      <GripVertical size={12} className="text-gray-300 shrink-0 cursor-grab" />
      <span className="truncate flex-1" title={note.topic}>
        {note.topic}
      </span>
      <Trash2
        size={13}
        className="text-gray-300 hover:text-red-500 shrink-0 ml-1"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Удалить тему «${note.topic}»?`)) onDelete();
        }}
      />
    </div>
  );
}
