-- 051 clean reseed: realistic demo names + brigade structure (case sect.8).
-- Additive, non-destructive: renames synthetic seed rows, adds brigade column.
alter table employees add column if not exists brigade text;

update employees set name='Бериков Сейтек', brigade='Бригада 1' where name='Тестовый исполнитель 3';
update employees set name='Смаилов Даурен', brigade='Бригада 1' where name='Тестовый исполнитель 4';
update employees set name='Кусаинов Ерлан', brigade='Бригада 1' where name='Тестовый исполнитель 5';
update employees set name='Оспанов Марат', brigade='Бригада 1' where name='Тестовый исполнитель 6';
update employees set brigade='Бригада 1' where name='Исполнитель Ахметов';
update employees set name='Жумабеков Айбек', brigade='Бригада 2' where name='Тестовый исполнитель 7';
update employees set name='Тлеубеков Нурлан', brigade='Бригада 2' where name='Тестовый исполнитель 8';
update employees set name='Абдрахманов Серик', brigade='Бригада 2' where name='Тестовый исполнитель 9';
update employees set name='Ермеков Жандос', brigade='Бригада 2' where name='Тестовый исполнитель 10';
update employees set brigade='Бригада 2' where name='Исполнитель Сейтов';
update employees set name='Галиев Тимур', brigade='Бригада 3' where name='Тестовый исполнитель 11';
update employees set name='Ибраев Руслан', brigade='Бригада 3' where name='Тестовый исполнитель 12';
update employees set name='Калиев Арман', brigade='Бригада 3' where name='Тестовый исполнитель 13';
update employees set name='Нургожин Болат', brigade='Бригада 3' where name='Тестовый исполнитель 14';
update employees set name='Сарсенов Кайрат', brigade='Бригада 3' where name='Тестовый исполнитель 15';
update employees set name='Ахметов Ержан' where name='Исполнитель Ахметов';
update employees set name='Сейтов Нуржан' where name='Исполнитель Сейтов';

update equipment set name='Конвейер К-5' where name='Тестовый агрегат 6';
update equipment set name='Насос Н-2' where name='Тестовый агрегат 7';
update equipment set name='Дробилка Д-1' where name='Тестовый агрегат 8';
update equipment set name='Мельница М-2' where name='Тестовый агрегат 9';
update equipment set name='Вентилятор В-3' where name='Тестовый агрегат 10';
update equipment set name='Компрессор КП-1' where name='Тестовый агрегат 11';
update equipment set name='Грохот Г-1' where name='Тестовый агрегат 12';
update equipment set name='Элеватор Э-2' where name='Тестовый агрегат 13';
update equipment set name='Питатель П-5' where name='Тестовый агрегат 14';
update equipment set name='Транспортер Т-1' where name='Тестовый агрегат 15';
update equipment set name='Сепаратор С-3' where name='Тестовый агрегат 16';
update equipment set name='Смеситель СМ-1' where name='Тестовый агрегат 17';
update equipment set name='Шкаф Ш-7' where name='Тестовый агрегат 18';
update equipment set name='Двигатель Д-8' where name='Тестовый агрегат 19';
update equipment set name='Редуктор Р-4' where name='Тестовый агрегат 20';
update equipment set name='Конвейер К-7' where name='Тестовый агрегат 21';
update equipment set name='Насос Н-6' where name='Тестовый агрегат 22';
update equipment set name='Компрессор КП-2' where name='Тестовый агрегат 23';
update equipment set name='Грохот Г-4' where name='Тестовый агрегат 24';
update equipment set name='Транспортер Т-6' where name='Тестовый агрегат 25';
